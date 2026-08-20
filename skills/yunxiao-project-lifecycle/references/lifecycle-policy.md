# Lifecycle policy

## Official capability map

Use verified equivalent capabilities when a client presents names differently. The official hosted server currently exposes these useful tools:

| Intent | Official tools |
|---|---|
| Current identity and organizations | `get_current_user`, `get_current_organization_info`, `get_user_organizations` |
| Projects | `search_projects`, `get_project` |
| Members | `search_organization_members`, `get_organization_member_info_by_user_id` |
| Code repositories | `list_repositories`, `get_repository` |
| Branches and files | `list_branches`, `get_branch`, `create_branch`, `list_files`, `get_file_blobs`, `create_file`, `update_file` |
| Commits and comparison | `list_commits`, `get_commit`, `get_compare` (or the verified equivalent `compare`) |
| Merge requests | `list_change_requests`, `get_change_request`, `create_change_request`, `create_change_request_comment`, `review_change_request`, `merge_change_request` |
| Pipelines and runs | `list_pipelines`, `get_pipeline`, `get_latest_pipeline_run`, `list_pipeline_runs`, `get_pipeline_run` |
| Pipeline tasks and logs | `list_pipeline_jobs_by_category`, `list_pipeline_job_historys`, `get_pipeline_job_run_log` |
| Work items | `search_workitems`, `get_work_item`, `create_work_item`, `update_work_item` |
| Types and workflows | `list_work_item_types`, `get_work_item_type`, `get_work_item_workflow` |
| Comments and activity | `list_work_item_comments`, `create_work_item_comment`, `list_workitem_activities` |
| Sprints | `list_sprints`, `get_sprint`, `create_sprint`, `update_sprint` |
| Versions/milestones | `list_versions`, `create_version`, `update_version` |

Do not assume a tool exists merely because this table lists it. Gate each requested action on the current MCP tool list and input contract.

## Action matrix

| Action | v1 decision |
|---|---|
| Read projects, members, requirements, defects, tasks, comments, activity, sprints, versions | Execute after read-only capability/auth checks |
| Read repositories, branches, files, commits, comparisons, and merge requests | Execute after the request-specific `code-management` capability/auth checks |
| Read pipelines, pipeline details, runs, tasks, and logs | Execute after the request-specific `pipeline-management` capability/auth checks and stable target resolution |
| Trigger/retry/cancel a pipeline or execute a pipeline task | Reject in the minimal pipeline scope; do not substitute another API client |
| Create/update/delete pipeline definitions, resources, tags, or deployments | Reject in the minimal pipeline scope; do not substitute another API client |
| Create one branch, file change, or merge request | Execute when the user explicitly requests it, targets are unique, required fields exist, and duplicate/branch checks pass |
| Comment on, review, or merge one merge request | Execute only for an explicit target and action after reading its current state; the merge type must be explicit and source-branch deletion remains disabled in v1 |
| Manage one repository member | Execute only when a verified repository-membership tool contract exists; otherwise reject with `CAPABILITY_MISSING` |
| Create one requirement, defect, or task | Execute when the user explicitly requests it, binding/type/assignee are unique, required fields exist, and duplicate check passes |
| Assign one work item | Execute when the user explicitly requests it and the member is uniquely resolved, enabled, and assignable |
| Add one comment | Execute when target and content are explicit |
| Update one field or perform one legal status transition | Execute after current-object and workflow validation |
| Create/update one sprint or version | Execute when dates, owner, bound project, and intended semantics are explicit |
| Analyze, summarize, inspect, plan, triage, recommend | Read only; never infer a write |
| Explicitly authorized bounded multi-object update | Execute sequentially for at most 20 uniquely identified objects when every object receives the same explicit field change; pre-read and post-read each object, stop on the first failure, and report partial results |
| Bulk API write, inferred/open-ended batch, mixed-operation batch, batch create, delete, true archive, scheduled write | Reject in v1 with zero write calls |

## Single-write protocol

1. Resolve and remotely validate the organization/project binding.
2. Resolve all named targets to exactly one stable ID.
3. Read the target's current state immediately before writing.
4. Validate explicit intent, required fields, current workflow, and scope.
5. Search for duplicate candidates when creating.
6. Submit one write call; never issue concurrent writes for the same logical change.
7. Read the same object and compare the fields requested by the user.
8. Return one result state and enough non-secret context to audit it.

## Bounded multi-write protocol

Use this protocol only when the user explicitly identifies every target and requests the same unambiguous update for all targets.

1. Limit the ordered set to 20 objects and resolve every target to exactly one stable ID before the first write.
2. Validate the organization, project, member, requested field, and scope once, then pre-read each target immediately before its write.
3. Submit one ordinary single-object write at a time. Never use a bulk endpoint or concurrent writes.
4. Post-read and verify each object before moving to the next.
5. Stop immediately on rejection, failure, uncertainty, or verification mismatch. Never compensate or roll back earlier verified writes automatically.
6. Report each object as `VERIFIED_SUCCESS`, `SUBMITTED_UNVERIFIED`, `REJECTED`, or `FAILED`, and state clearly when only a prefix of the ordered set was completed.

Reject with zero writes when targets are inferred from a broad query such as “all defects,” the objects need different changes, any target is ambiguous, the set exceeds 20, or the user has not explicitly authorized the full set.

## Creation rules

- Requirement category is `Req`, defect category is `Bug`, and task category is `Task`; first resolve the bound project's concrete work-item type ID.
- `create_work_item` requires an assignee. Use an explicit user choice, then a remotely validated project default, then unique dynamic discovery. If none exists, ask instead of inventing an owner.
- Check active work items in the bound project for the same category and exact normalized title. A candidate duplicate stops creation and is shown to the user.
- Do not treat a similar title as proof of duplication. Ask when the match is uncertain.
- Resolve parent, sprint, version, labels, participants, trackers, and verifier only when explicitly requested or defined by a validated project convention.

## Code management rules

- Resolve a repository by explicit stable ID/path or a unique `list_repositories` result. Never select the first same-name repository.
- Before creating a merge request, read the source and target branches, confirm the comparison contains changes, and check for an existing open request for the same repository and source/target pair.
- `create_change_request` requires an explicit repository, source branch, target branch, and title. Do not trigger AI review or request source-branch deletion in v1.
- Before reviewing or merging, read the current merge request. A review decision and merge type are explicit user inputs; do not infer approval or merge from a request to inspect or comment.
- Organization membership does not establish repository membership. Repository-member add, role-change, and removal operations need their own verified MCP tools and stable member IDs.

## Assignment and workflow rules

- Match members by stable ID after search. Zero or multiple same-name matches stop the write.
- Verify that a configured default member is enabled and belongs to the active organization before each use.
- Read the current work-item type workflow and current status before changing status.
- The target status must be reachable from the current state under the visible workflow. Do not set a status merely because its display name sounds appropriate.
- If workflow data cannot establish legality, reject rather than bypassing the workflow.

## Milestones, release, and archival

Use Yunxiao versions for release milestones only when that convention is explicit. Sprints represent iteration timeboxes, not milestones. A version marked released/archived, a completed work item, a deleted work item, and a truly archived work item have different meanings.

The current MCP does not expose a verified work-item/project archival operation. Report that limitation. Never call delete or move to a completed status as an archive substitute.

## Uncertain writes and duplicate retry

The current tool contracts do not expose a uniform idempotency key, ETag, or conditional version. Therefore:

- On timeout or transport uncertainty, do not retry immediately.
- Re-query the target, recent comments, and activity to determine whether the side effect occurred.
- Before retrying a comment, compare recent comment content.
- Before retrying creation, repeat the category/title duplicate search.
- If another actor changed relevant state between pre-read and post-read, report a conflict and do not overwrite or compensate automatically.

## Result semantics

- `VERIFIED_SUCCESS`: post-read proves the same object contains every requested change.
- `SUBMITTED_UNVERIFIED`: the write may have succeeded, but post-read failed, remained inconsistent, or could not prove the result. Do not retry automatically.
- `REJECTED`: binding, target uniqueness, required fields, duplicate checks, workflow, capability, or v1 policy blocked the operation. No write was submitted.
- `FAILED`: MCP explicitly rejected the write and there is no evidence of a side effect.

Report the bound project display name, object identifier, requested field summary, and result state. Preserve the meaning of MCP errors while removing tokens, authorization headers, cookies, temporary URLs, and unnecessary personal data.

## Automation boundary

An interactive user's permission for direct single writes does not authorize unattended writes. Scheduled analysis is read-only in v1. A later automation must define its own project binding, service identity, allowed action set, rate/concurrency limits, cursor, duplicate policy, audit sink, retry rules, and human escalation path.
