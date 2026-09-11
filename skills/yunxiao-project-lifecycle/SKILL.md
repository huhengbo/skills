---
name: yunxiao-project-lifecycle
description: Manage Alibaba Cloud Yunxiao (云效) project, Codeup repository, Flow pipelines, package repositories, application delivery, and test lifecycles through the official MCP. Use for Yunxiao project binding, requirements/defects/tasks, repositories, branches, files, merge requests, reviews, pipelines, jobs/logs, packages, applications, deployments, tests, deletion, archival, scheduling, bounded automation, MCP setup, diagnostics, and yunxiao.toml.
---

# Yunxiao Project Lifecycle

Use this file as the task entry point. Detailed service rules live in references and should be loaded only when the request needs them.

## Start every task

1. Identify the requested operation and whether it is read-only, a single write, a bounded multi-object write, or a high-risk action.
2. Verify the active Yunxiao MCP/authentication and only the capability needed by the request. Follow [MCP setup](references/mcp-setup.md) for missing auth, transport, protocol, or tools. Do not invent a second Yunxiao API client as a fallback.
3. Resolve the project root and read `<project-root>/yunxiao.toml`. Follow [project binding](references/project-binding.md). A missing binding allows discovery reads only; an invalid/stale binding blocks writes.
4. Before any write, load the relevant section of [lifecycle policy](references/lifecycle-policy.md). That document is the normative source for operation-specific capability maps, action rules, duplicate checks, multi-write limits, deletion/archival rules, pipeline/application/test behavior, and result semantics.

## Context and target resolution

- Project binding comes only from repository-root `yunxiao.toml`; never substitute a global organization variable, recent history, or a same-name project.
- Prefer an explicit user target, then a remotely validated configured default, then dynamic discovery that returns exactly one candidate.
- Resolve names to current stable IDs before writes. Zero or multiple matches block the write.
- Revalidate configured work-item types, assignees, workflows, and other mutable defaults before use.
- A request for “latest” may use a latest lookup; an explicit run/job/object ID must never be silently replaced with another target.

## Read/write boundary

Requests to analyze, summarize, inspect, plan, triage, or recommend are read-only. Do not infer a mutation from them.

For an allowed single-object write:

1. Read the current object and bound project.
2. Validate explicit intent, exact target, required fields, duplicates, permissions/tool contract, and workflow legality.
3. Submit exactly one write.
4. Read the same object again and verify the requested fields.
5. Report `VERIFIED_SUCCESS`, `SUBMITTED_UNVERIFIED`, `REJECTED`, or `FAILED` using the definitions in lifecycle policy.

For an explicitly authorized same-change update across several objects, use the bounded multi-write protocol from lifecycle policy: resolve all targets first, process sequentially, stop on the first failure/uncertainty, and never broaden an inferred target set.

## Non-negotiable safety rules

- Never write without a unique remotely verified project binding and exact target.
- Never choose the first same-name project, repository, member, type, sprint, version, work item, pipeline, application, test object, or other mutable target.
- Never automatically retry an uncertain write; read first to determine whether the side effect occurred.
- Never hide partial success, permission failures, MCP errors, or post-write mismatches.
- Never substitute organization membership for repository membership.
- Treat delete, true archive, deployment/rollback/destroy, scheduled writes, and unattended automation as distinct explicit high-risk actions. Missing matching tools/contracts means `CAPABILITY_MISSING`.
- Never substitute delete/complete/disable/release for archival, and never invent a scheduler or open-ended local loop.
- Redact tokens, authorization headers, cookies, temporary signed values, unnecessary personal data, and secret-like fields from logs/results.

## Operation-specific guidance

Load [lifecycle policy](references/lifecycle-policy.md) for the exact operation instead of duplicating its rules here. It contains the current guidance for:

- work items, assignments, workflow transitions, sprints, versions, and comments;
- Codeup repositories, branches/files, comparisons, merge requests, reviews, merges, and repository membership;
- Flow pipeline definitions, runs, job/task controls, logs, resources, variable groups, tags, and deployment targets;
- packages/artifacts and unsupported package writes;
- applications, orchestration, release stages, deployment actions, tags, and variables;
- test directories/cases/plans/results;
- deletion, true archival, schedules, unattended automation, uncertain writes, and duplicate retry handling.

## Portable tooling

From this Skill directory:

```text
node scripts/doctor.mjs --project-root <project-root>
node scripts/doctor.mjs --project-root <project-root> --json
node scripts/install.mjs --target <agent-skill-directory>
node scripts/install.mjs --target <agent-skill-directory> --apply
```

`doctor.mjs` is read-only. `install.mjs` is dry-run-first and never configures credentials. Canonical tooling uses Node.js 18+ and must run natively on Windows, macOS, and Linux without requiring Bash or WSL.

## Resources

- [MCP setup](references/mcp-setup.md): authentication, transport/protocol diagnostics, platform guidance, and repair boundaries.
- [Project binding](references/project-binding.md): `yunxiao.toml` schema, project-root resolution, remote validation, and binding creation.
- [Lifecycle policy](references/lifecycle-policy.md): normative tool/action matrix, object-specific rules, bounded writes, deletion/archival/automation, and result semantics.
- `scripts/doctor.mjs`: portable read-only diagnostics.
- `scripts/install.mjs`: explicit-target portable installation.
