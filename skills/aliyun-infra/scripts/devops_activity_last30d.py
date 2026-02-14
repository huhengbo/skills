#!/usr/bin/env python3
"""Aggregate Aliyun DevOps repository activity for a time window.

This script is environment-agnostic and requires explicit inputs.
It does not store credentials or organization defaults.
"""

import argparse
import json
import subprocess
from collections import Counter
from datetime import datetime, timedelta, timezone


def run(args):
    proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"command failed ({proc.returncode}): {' '.join(args)}\n{proc.stderr.strip()}")
    return proc.stdout


def aliyun_devops(operation, profile, **kwargs):
    cmd = ["aliyun", "devops", operation]
    for k, v in kwargs.items():
        if v is None:
            continue
        cmd += [f"--{k}", str(v)]
    cmd += ["--profile", profile]
    return json.loads(run(cmd))


def list_repositories(org_id, profile):
    page = 1
    page_size = 100
    repos = []
    while True:
        obj = aliyun_devops(
            "ListRepositories",
            profile,
            organizationId=org_id,
            page=page,
            perPage=page_size,
        )
        batch = obj.get("result") or []
        repos.extend(batch)
        total = obj.get("total")
        if total is not None and len(repos) >= int(total):
            break
        if len(batch) < page_size:
            break
        page += 1
    return repos


def list_commits(org_id, repo_id, profile, start_iso, end_iso, refs):
    last_error = None
    for ref in refs:
        try:
            page = 1
            page_size = 100
            commits = []
            while True:
                obj = aliyun_devops(
                    "ListRepositoryCommits",
                    profile,
                    organizationId=org_id,
                    repositoryId=repo_id,
                    refName=ref,
                    start=start_iso,
                    end=end_iso,
                    page=page,
                    pageSize=page_size,
                )
                batch = obj.get("result") or []
                commits.extend(batch)
                if len(batch) < page_size:
                    break
                page += 1
            return ref, commits
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    if last_error:
        raise last_error
    raise RuntimeError("no refs provided")


def parse_diff_text(diff_text):
    additions = 0
    deletions = 0
    for line in (diff_text or "").splitlines():
        if line.startswith(("+++", "---", "@@")):
            continue
        if line.startswith("+"):
            additions += 1
        elif line.startswith("-"):
            deletions += 1
    return additions, deletions


def commit_diff_stats(org_id, repo_id, sha, profile):
    obj = aliyun_devops(
        "ListRepositoryCommitDiff",
        profile,
        organizationId=org_id,
        repositoryId=repo_id,
        sha=sha,
        contextLine=0,
    )
    files = obj.get("result") or []
    changed = 0
    adds = 0
    dels = 0
    for item in files:
        changed += 1
        a, d = parse_diff_text(item.get("diff"))
        adds += a
        dels += d
    return {"filesChanged": changed, "additions": adds, "deletions": dels}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--organizationId", required=True)
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--maxRepos", type=int, default=0, help="0 means all")
    parser.add_argument("--refs", default="master,main", help="comma-separated branch refs")
    return parser.parse_args()


def main():
    args = parse_args()
    refs = [r.strip() for r in args.refs.split(",") if r.strip()]
    if not refs:
        raise RuntimeError("at least one ref is required")

    tz = timezone(timedelta(hours=8))
    end = datetime.now(tz)
    start = end - timedelta(days=args.days)
    start_iso = start.strftime("%Y-%m-%dT%H:%M:%S%z")
    end_iso = end.strftime("%Y-%m-%dT%H:%M:%S%z")

    repos = list_repositories(args.organizationId, args.profile)
    if args.maxRepos > 0:
        repos = repos[: args.maxRepos]

    total_commits = 0
    author_commits = Counter()
    author_adds = Counter()
    author_dels = Counter()
    author_files = Counter()
    repo_stats = {}
    failures = []

    for repo in repos:
        repo_id = repo.get("Id")
        repo_name = repo.get("name")
        if repo_id is None:
            continue
        try:
            ref, commits = list_commits(
                args.organizationId,
                repo_id,
                args.profile,
                start_iso,
                end_iso,
                refs,
            )
            repo_stats[str(repo_id)] = {"name": repo_name, "count": len(commits), "ref": ref}
            total_commits += len(commits)
            for c in commits:
                sha = c.get("id") or c.get("sha")
                name = c.get("authorName") or (c.get("author") or {}).get("name") or "unknown"
                email = c.get("authorEmail") or (c.get("author") or {}).get("email")
                author = f"{name} <{email}>" if email else name
                author_commits[author] += 1
                if sha:
                    stats = commit_diff_stats(args.organizationId, repo_id, sha, args.profile)
                    author_adds[author] += stats["additions"]
                    author_dels[author] += stats["deletions"]
                    author_files[author] += stats["filesChanged"]
        except Exception as exc:  # noqa: BLE001
            failures.append({"repoId": repo_id, "name": repo_name, "error": str(exc)[:240]})

    top_users = []
    for user, commits in author_commits.most_common(50):
        top_users.append(
            {
                "user": user,
                "commits": commits,
                "additions": int(author_adds.get(user, 0)),
                "deletions": int(author_dels.get(user, 0)),
                "filesChanged": int(author_files.get(user, 0)),
                "netLines": int(author_adds.get(user, 0) - author_dels.get(user, 0)),
            }
        )

    top_repos = sorted(repo_stats.items(), key=lambda kv: kv[1]["count"], reverse=True)[:50]

    output = {
        "organizationId": args.organizationId,
        "profile": args.profile,
        "window": {"days": args.days, "start": start_iso, "end": end_iso},
        "reposScanned": len(repos),
        "reposWithCommits": sum(1 for v in repo_stats.values() if v["count"] > 0),
        "totalCommits": total_commits,
        "activeUsers": len(author_commits),
        "topUsersByCommits": top_users,
        "topReposByCommits": [
            {
                "repoId": repo_id,
                "name": info["name"],
                "commits": info["count"],
                "ref": info["ref"],
            }
            for repo_id, info in top_repos
        ],
        "failures": failures,
        "notes": [
            "Commit list uses ListRepositoryCommits across provided refs.",
            "Line stats approximate + and - counts from ListRepositoryCommitDiff.",
            "Branch-only activity outside selected refs may be excluded.",
        ],
    }
    print(json.dumps(output, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
