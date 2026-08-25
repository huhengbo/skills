---
name: yunxiao-project-lifecycle
description: Manage Alibaba Cloud Yunxiao (云效) project, Codeup repository, Flow pipelines, package repositories, application delivery, and test lifecycles through the official MCP, including repositories, branches, commits, files, merge requests, reviews, work items, sprints, versions, pipelines, pipeline jobs, resources, tags, deployments, packages, applications, tests, deletion, archival, scheduling, and bounded automation. Use when a request concerns Yunxiao project binding or lifecycle work such as 需求、缺陷、工作项、代码库、分支、合并请求、流水线、任务、资源、标签、部署、包仓库、应用交付、测试、归档、定时写入、自动化写入, query, create, update, delete, review, merge, triage, or automation; also use to install, configure, or diagnose the Yunxiao MCP integration and yunxiao.toml.
---

# Yunxiao Project Lifecycle

## Start every task

1. Detect whether the active environment exposes the official Yunxiao MCP capabilities needed by the request. Code actions require the `code-management` capability; pipeline actions require `pipeline-management`; package reads require `packages-management`; application delivery requires `application-delivery`; test actions require `test-management`; repository-member writes require a separately verified repository-membership capability. Deletion, archival, scheduled writes, and unattended automation additionally require a matching verified tool contract. Do not assume a client name, installation directory, server alias, or tool namespace.
2. If capabilities or authentication are missing, stop all Yunxiao writes and follow [MCP setup](references/mcp-setup.md). Resolve paths from this `SKILL.md` directory and run `node <this-skill-directory>/scripts/doctor.mjs --project-root <project-root>` when Node.js 18+ is available.
3. Resolve the project root and read `<project-root>/yunxiao.toml`. Follow [project binding](references/project-binding.md). Without a valid binding, allow organization/project/repository discovery only; never guess a write target.
4. Read [lifecycle policy](references/lifecycle-policy.md) before any create or update operation.

## Capability gate

Treat the MCP as ready only after a minimal read-only identity call succeeds and the tools required for the requested operation are present. Equivalent tools are acceptable when their input and result contracts are verified. Missing or ambiguous capability means stop and report `CAPABILITY_MISSING`; do not implement a second Yunxiao API client as a fallback.

The official hosted MCP endpoint and credentials belong to the environment, not the repository. Use `ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN` as the primary token variable and accept `YUNXIAO_ACCESS_TOKEN` only as a same-value legacy alias. If both exist with different values, stop with `CONFIG_ERROR` before any network call. Never request that a user paste or fill a token during project setup.

Resolve organization and project IDs only from the repository-root `yunxiao.toml`. Never use `ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID` or another global organization variable as a write binding. Never put credentials, endpoint overrides, cookies, or authorization headers in `yunxiao.toml`.

## Resolve context and targets

- Prefer an explicit user-selected target, then a validated default from `yunxiao.toml`, then dynamic discovery.
- Resolve repository, branch, merge-request, work-item, pipeline, pipeline-run, and other names to current stable IDs. Zero or multiple matches require user selection.
- For a pipeline run or task log, bind the request to a unique pipeline ID plus run/job ID. Use a latest-run lookup only when the user explicitly asks for the latest run.
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

Directly execute explicit single-object branch/file change, merge-request creation, review/comment, assignment, field update, legal status-transition, pipeline-control, application-delivery, package, and test requests when all object-specific checks pass. Do not infer writes from requests to analyze, summarize, inspect, plan, or recommend.

Pipeline list, detail, run-history, task-history, and log requests are read-only. Execute them only after the `pipeline-management` capability and each requested tool's input contract are verified; do not infer a trigger, retry, cancellation, deployment, or configuration change from a read request.

## Hard safety rules

- Never write without a unique, remotely verified organization and project binding.
- Never guess a repository or branch from a name when discovery returns zero or multiple matches.
- Never choose the first same-name project, member, type, sprint, version, or work item.
- Never retry an uncertain write until a read confirms that the side effect did not occur.
- Never hide partial success, permission failures, MCP errors, or post-write mismatches.
- Do not use bulk-write APIs or infer a multi-object scope. An explicitly authorized ordered set of no more than 20 uniquely identified objects may be processed sequentially under the bounded multi-write protocol in the lifecycle policy.
- Do not use organization-member tools as a substitute for repository-member permission tools.
- Treat deletion, true archival, scheduled writes, and unattended automation as explicit high-risk actions. Allow them only when the user requests the exact object and action, the active MCP exposes a matching tool/input contract, and the object-specific policy below passes. Never substitute deletion or a completed status for archival.
- Do not automatically retry or broaden a pipeline action. An explicit request may cancel one run or job, execute one job/task, delete one pipeline definition, change one resource/member/tag, or perform one deployment only after exact target resolution, contract validation, pre-read, one write, and post-read verification. A missing tool is `CAPABILITY_MISSING`; never use a second API client. Redact token, cookie, authorization, and other secret-like values from pipeline and deployment logs while preserving relevant failure context.
- Keep unattended writes read-only unless a separate automation policy explicitly authorizes a bounded write scope with identity, targets, allowed actions, trigger/cadence, concurrency/rate, retry, audit, stop, and escalation rules. Scheduled writes additionally require a matching schedule contract; do not invent a scheduler or run an open-ended loop.
- Redact tokens, authorization headers, cookies, personal data not needed for the result, and internal error payloads that may contain secrets.

## Code management

- For a merge request, require an explicit repository, source branch, target branch, and title; read both branches, check for changes, and check for an existing open request before creating one.
- For review or merge, read the current request first. The review decision and merge type must be explicit; source-branch deletion remains disabled by the v1 deletion rule.
- For repository-member operations, execute only when the active MCP exposes and the request-specific contract verifies repository membership and role operations. Otherwise report `CAPABILITY_MISSING` without a fallback API call.

## Pipeline management

- For a pipeline list or search, use `list_pipelines` or another verified pipeline-list tool and require a unique stable ID before reading a named pipeline.
- For pipeline details, use `get_pipeline` after resolving the pipeline ID. Do not assume a pipeline is project-scoped when the tool contract requires an organization ID and pipeline ID.
- For run status and history, use `get_latest_pipeline_run`, `list_pipeline_runs`, or `get_pipeline_run` according to the user's requested scope. Do not replace a requested run ID with the latest run.
- For task history and logs, use `list_pipeline_jobs_by_category`, `list_pipeline_job_historys`, and `get_pipeline_job_run_log` only after resolving the exact pipeline, run, and job identifiers required by the active tool contract.
- For an explicitly requested pipeline-definition creation, check for an exact-name duplicate, create exactly one pipeline without running it, then read the returned pipeline ID. If the creation tool cannot accept the complete requested YAML, one immediate `update_pipeline` call for that newly created ID is allowed to finish the same requested definition before post-read verification.
- For an explicitly requested update, resolve exactly one pipeline ID, read its current definition, submit one `update_pipeline` call, then read it again and compare the requested name and YAML content.
- For an explicitly requested single run, read the pipeline definition immediately before execution, confirm that the requested branch/tag and runtime variables are explicit and valid, reject deploy-capable definitions unless deployment is separately authorized, call `create_pipeline_run` exactly once, then monitor that returned run ID. A failed run does not authorize an automatic retry or configuration change; a separate ongoing debugging authorization may scope additional sequential runs to one pipeline, input set, and success condition.
- For an explicitly requested cancellation or single-task action, resolve the exact pipeline/run/job/task and action first, then use only the verified matching control tool such as `stop_pipeline_job_run`, `execute_pipeline_job_run`, `retry_pipeline_job_run`, `rerun_pipeline_job_run`, `skip_pipeline_job_run`, or `execute_pipeline_job_action`. Do not infer cancellation, retry, skip, or execution from a read request.
- For resources, members, variable groups, tags, or deployments, require the exact resource type and ID plus the verified action tool; read the object before and after the one write. Delete, archive, and deployment operations remain subject to the high-risk rules below.

## Application delivery, packages, and tests

- For application delivery, resolve one application and, when relevant, one orchestration, variable group, tag, change order, release stage, environment, or deployment target. Treat deploy, scale, rollback, destroy, release-stage execute/cancel/retry/skip, and application orchestration changes as separate explicit actions; read the current object, submit one matching tool call, and verify the result.
- For package repositories and artifacts, use only the currently exposed package tools such as `list_package_repositories`, `list_artifacts`, and `get_artifact`. Do not invent upload, delete, archive, retention, or package-write tools; report `CAPABILITY_MISSING` until the active MCP exposes and verifies the requested contract.
- For tests, resolve one test directory, case, plan, result, or tag. Use the verified testcase create/delete and result-update tools for explicit requests; do not treat updating a result as updating or deleting a case/plan. Unsupported test-plan deletion, archival, scheduling, or automated execution is `CAPABILITY_MISSING` until a matching MCP tool is visible.
- Application, package, and test writes follow the same exact-ID, read-before/write-once/read-after protocol. A request covering several objects must explicitly identify every object and remain within the bounded multi-write limit.

## Deletion, archival, schedules, and automation

- Allow one deletion only when the exact target is uniquely resolved, a matching delete tool is visible, the user explicitly requested deletion, and the post-write read proves the target is deleted or terminally absent. Do not infer cleanup from a delete request for another object.
- Allow true archival only when the active MCP exposes a matching archive operation or a documented archived-state field for that object. A delete, close, complete, disable, or retention change is not archival. The current official catalog has no generic archive operation, so unsupported archive requests must return `CAPABILITY_MISSING`.
- Allow one scheduled write only when the active tool contract accepts the requested target, action, schedule/cadence, timezone, enabled state, and stop condition. Verify the saved schedule after writing. The current official catalog has no standalone generic scheduler; do not simulate one with a loop or local cron.
- Allow unattended automation only under a separate bounded policy that names the service identity, project binding, exact targets, permitted actions, trigger, cadence, concurrency/rate limit, duplicate rule, retry rule, audit sink, stop condition, and human escalation. Run one ordinary write at a time and preserve `REJECTED`, `FAILED`, and `SUBMITTED_UNVERIFIED` semantics.

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
