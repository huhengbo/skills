---
name: yunxiao-project-lifecycle
description: Manage Alibaba Cloud Yunxiao (云效) project lifecycles through the official MCP, including repository-to-project binding, setup diagnostics, requirements, defects, tasks, assignees, comments, statuses, sprints, versions, and milestones. Use when a request concerns Yunxiao project binding or lifecycle work such as 需求、缺陷、工作项、迭代、版本、里程碑、分配、归档, query, create, update, triage, or automation; also use to install, configure, or diagnose the Yunxiao MCP integration and yunxiao.toml.
---

# Yunxiao Project Lifecycle

## Start every task

1. Detect whether the active environment exposes the official Yunxiao MCP capabilities needed by the request. Do not assume a client name, installation directory, server alias, or tool namespace.
2. If capabilities or authentication are missing, stop all Yunxiao writes and follow [MCP setup](references/mcp-setup.md). Resolve paths from this `SKILL.md` directory and run `node <this-skill-directory>/scripts/doctor.mjs --project-root <project-root>` when Node.js 18+ is available.
3. Resolve the project root and read `<project-root>/yunxiao.toml`. Follow [project binding](references/project-binding.md). Without a valid binding, allow organization/project discovery only; never guess a write target.
4. Read [lifecycle policy](references/lifecycle-policy.md) before any create or update operation.

## Capability gate

Treat the MCP as ready only after a minimal read-only identity call succeeds and the tools required for the requested operation are present. Equivalent tools are acceptable when their input and result contracts are verified. Missing or ambiguous capability means stop and report `CAPABILITY_MISSING`; do not implement a second Yunxiao API client as a fallback.

The official hosted MCP endpoint and credentials belong to the environment, not the repository. Use `ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN` as the primary token variable and accept `YUNXIAO_ACCESS_TOKEN` only as a same-value legacy alias. If both exist with different values, stop with `CONFIG_ERROR` before any network call. Never request that a user paste or fill a token during project setup.

Resolve organization and project IDs only from the repository-root `yunxiao.toml`. Never use `ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID` or another global organization variable as a write binding. Never put credentials, endpoint overrides, cookies, or authorization headers in `yunxiao.toml`.

## Resolve context and targets

- Prefer an explicit user-selected target, then a validated default from `yunxiao.toml`, then dynamic discovery.
- Resolve names to current stable IDs. Zero or multiple matches require user selection.
- Revalidate configured work-item types against the bound project and configured assignees against the organization before use.
- Resolve status transitions from the current workflow. Never reuse static status IDs from another project.
- Treat versions as release milestones only when that matches the bound project's convention. Never equate completion, release, deletion, and archival.

## Execute lifecycle work

For every allowed single-object write, including each item in an explicitly authorized ordered set:

1. Read the current object and bound project.
2. Validate explicit user intent, required fields, duplicate candidates, target identity, and workflow legality.
3. Submit exactly one write call.
4. Read the same object again and compare the requested fields.
5. Report one of: `VERIFIED_SUCCESS`, `SUBMITTED_UNVERIFIED`, `REJECTED`, or `FAILED`.

Directly execute explicit single-object creation, assignment, comment, field update, and legal status-transition requests when all checks pass. Do not infer writes from requests to analyze, summarize, inspect, plan, or recommend.

## Hard safety rules

- Never write without a unique, remotely verified organization and project binding.
- Never choose the first same-name project, member, type, sprint, version, or work item.
- Never retry an uncertain write until a read confirms that the side effect did not occur.
- Never hide partial success, permission failures, MCP errors, or post-write mismatches.
- Do not use bulk-write APIs or infer a multi-object scope. An explicitly authorized ordered set of no more than 20 uniquely identified objects may be processed sequentially under the bounded multi-write protocol in the lifecycle policy.
- Do not execute deletions, true archival, or scheduled writes in v1. Do not substitute deletion or a completed status for archival.
- Keep automation read-only unless a separate automation policy explicitly authorizes a bounded write scope.
- Redact tokens, authorization headers, cookies, personal data not needed for the result, and internal error payloads that may contain secrets.

## Install a downloaded copy

This Skill cannot discover or install itself before an agent loads it. After obtaining the canonical package, use the client-neutral installer only with an explicitly selected skill directory:

```bash
node <downloaded-skill-directory>/scripts/install.mjs --target <agent-skill-directory>
node <downloaded-skill-directory>/scripts/install.mjs --target <agent-skill-directory> --apply
```

The first command is a dry run. The installer never guesses a client directory or configures MCP credentials.

## Resources

- [MCP setup](references/mcp-setup.md): portable preflight, official endpoint, authentication, platform guidance, status model, and repair boundaries.
- [Project binding](references/project-binding.md): `yunxiao.toml` schema, root resolution, validation, and binding creation.
- [Lifecycle policy](references/lifecycle-policy.md): tool capability map, action matrix, idempotency limits, write verification, and error semantics.
- `scripts/doctor.mjs`: read-only portable diagnostics.
- `scripts/install.mjs`: explicit-target, dry-run-first portable installation.
