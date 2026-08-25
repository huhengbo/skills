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
| Pipelines and runs | `list_pipelines`, `get_pipeline`, `create_pipeline_from_description`, `update_pipeline`, `create_pipeline_run`, `get_latest_pipeline_run`, `list_pipeline_runs`, `get_pipeline_run` |
| Pipeline tasks and logs | `list_pipeline_jobs_by_category`, `list_pipeline_job_historys`, `get_pipeline_job_run_log`, `get_pipeline_job_steps`, `get_pipeline_job_step_log` |
| Pipeline task controls | `execute_pipeline_job_run`, `stop_pipeline_job_run`, `retry_pipeline_job_run`, `rerun_pipeline_job_run`, `skip_pipeline_job_run`, `execute_pipeline_job_action` |
| Pipeline resources and variable groups | `list_resource_members`, `create_resource_member`, `update_resource_member`, `delete_resource_member`, `update_resource_owner`, `create_flow_variable_group`, `update_flow_variable_group`, `delete_flow_variable_group` |
| Package repositories and artifacts | `list_package_repositories`, `list_artifacts`, `get_artifact` |
| Applications | `list_applications`, `get_application`, `create_application`, `update_application` |
| Application tags | `create_app_tag`, `update_app_tag`, `search_app_tags`, `update_app_tag_bind` |
| Application orchestration and variables | `list_app_orchestration`, `get_app_orchestration`, `create_app_orchestration`, `delete_app_orchestration`, `update_app_orchestration`, `get_variable_group`, `create_variable_group`, `update_variable_group`, `delete_variable_group` |
| Application delivery and release | `create_change_order`, `execute_app_release_stage`, `cancel_app_release_stage_execution`, `retry_app_release_stage_pipeline`, `skip_app_release_stage_pipeline`, `pass_app_release_stage_validate`, `refuse_app_release_stage_validate` |
| Test management | `list_testcase_directories`, `create_testcase_directory`, `create_testcase`, `search_testcases`, `get_testcase`, `delete_testcase`, `list_test_plans`, `get_test_result_list`, `update_test_result`, `get_test_plan_progress`, `list_test_plan_result_directories` |
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
| Trigger one pipeline run | Execute only on an explicit request after reading the exact pipeline definition, validating branch/tag and runtime variables, and monitoring the returned run ID |
| Cancel, execute, retry, rerun, or skip one pipeline job/task | Execute only for the exact pipeline, run, job, and action after the matching control tool and input contract are verified; never infer the action from a read request |
| Create/update one pipeline definition | Execute only on an explicit request after exact-name/target checks; do not run it implicitly; read back and verify the ID, name, and YAML |
| Delete one pipeline definition | Execute only if a matching delete tool is visible and the user explicitly names the exact pipeline; the current official catalog has no verified `delete_pipeline`, so otherwise return `CAPABILITY_MISSING` |
| Manage one resource/member, variable group, or tag | Execute only for an exact resource and user/member/role or variable/tag change using a verified matching tool; read before and after the write |
| Perform one deployment, rollback, scale, destroy, or release-stage action | Execute only when the user explicitly names the application, environment/target, version or revision, and action; use the matching application-delivery tool and verify the resulting change order or stage state |
| Read package repositories and artifacts | Execute after `packages-management` capability/auth checks and exact repository/artifact resolution |
| Create, upload, update, delete, archive, or schedule package content | Return `CAPABILITY_MISSING` unless the active MCP exposes and verifies a matching tool; do not invent a package API |
| Create/update one application, orchestration, variable group, or application tag | Execute on an explicit request with exact application/resource identity, duplicate checks, and read-back verification |
| Delete one application orchestration, variable group, or supported application object | Execute only with an explicit target and matching delete tool; verify terminal absence or deleted state |
| Create/delete one test case or directory, or update one test result | Execute only on an explicit target using the matching `test-management` tool; distinguish result updates from case/plan changes |
| Delete, true archive, schedule, or automate one object | Execute only under the deletion, archival, schedule, and automation rules below; missing matching tools are `CAPABILITY_MISSING` |
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
| Bulk API write, inferred/open-ended batch, mixed-operation batch, or batch create | Reject with zero write calls |

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

## Pipeline definition, task, and deployment rules

- Before creating a pipeline, search the bound organization for an exact name match. Any match stops creation; do not overwrite it. Create one definition only, do not run it implicitly, and read back the returned pipeline ID.
- If `create_pipeline_from_description` cannot express the complete requested YAML, one immediate `update_pipeline` call against that newly returned pipeline ID may finish the same creation request. This is not permission to update another pipeline.
- Before updating an existing pipeline, resolve one stable pipeline ID and read its current name and YAML. Submit one `update_pipeline` call, then read it again and compare the requested fields.
- A pipeline run is a separate write. For one explicit run, read the exact definition, validate branch/tag and runtime variables, reject deployment steps unless deployment is separately authorized, call `create_pipeline_run` once, and monitor that returned run ID. A failed run does not authorize an automatic retry.
- For cancellation or a single task action, require the exact pipeline ID, run ID, job ID, and action. Use only the verified matching control tool. `retry_pipeline_job_run`, `rerun_pipeline_job_run`, and `skip_pipeline_job_run` are explicit actions, not automatic recovery. `rerun_pipeline_job_run` is limited by the active tool contract to supported job types.
- For resource members, owners, Flow variable groups, tags, or deployment targets, resolve the exact resource type/ID and current state first. Submit one matching write and read the same object or operation status afterward. Never elevate a role, change a target, or deploy a revision from an inferred intent.

## Application delivery, packages, and tests

- Application delivery actions must identify the application plus the relevant orchestration, variable group, tag, environment, change order, release workflow/stage, revision, or deployment target. Deploy, rollback, scale, destroy, stage execution, cancellation, retry, skip, and approval are separate explicit actions.
- Application creation/update and orchestration, variable-group, and tag changes use exact identity, duplicate checks where applicable, one write, and read-back verification. Application orchestration and variable-group deletion are permitted only through their matching verified delete tools.
- Package management is currently read-only through `list_package_repositories`, `list_artifacts`, and `get_artifact`. Upload, create, update, delete, archive, retention, and scheduled package writes require a matching tool that is not currently in the official catalog; return `CAPABILITY_MISSING` rather than inventing one.
- Test management may create directories/cases, delete an exact test case, and update an exact test result when the matching tools are visible. A result update is not a case or test-plan update. Unsupported test-plan create/update/delete/archive, scheduled test writes, and automated test execution remain `CAPABILITY_MISSING` until a matching tool contract is exposed.

## Deletion and archival rules

- Allow one deletion only when the user explicitly names the exact object, the active MCP exposes the matching delete tool, the current object is read immediately before the call, and a post-write read proves deletion or terminal absence.
- Current verified deletions include resource members, Flow variable groups, application orchestration, application variable groups, and test cases where their named tools are visible. Pipeline-definition deletion, package deletion, application deletion, tag deletion, and test-plan deletion need their own matching tool; do not substitute close, disable, destroy, or another object's deletion.
- Allow true archival only when a matching archive tool or documented archived-state field is visible for that object. A delete, close, complete, disable, retention, or released state is not an archive. The current official catalog has no generic archive operation, so return `CAPABILITY_MISSING` for unsupported archival requests.

## Scheduled and automated writes

- Allow one scheduled write only when the active tool contract explicitly accepts target, action, cadence/timezone, enabled state, and stop condition, then read back the saved schedule. The current official catalog has no standalone generic scheduler; do not emulate one with a polling loop or local cron.
- Allow unattended automation only under a separate bounded policy that specifies service identity, project binding, exact targets, allowed actions, trigger/cadence, concurrency/rate, duplicate handling, retry behavior, audit sink, stop condition, and human escalation. Run ordinary writes sequentially and preserve `REJECTED`, `FAILED`, and `SUBMITTED_UNVERIFIED` outcomes.

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

An interactive user's permission for direct single writes does not authorize unattended writes. Scheduled analysis remains read-only unless a separate scheduled-write contract exists. Any later automation must satisfy the bounded policy above; a user request to automate one action is not permission to expand the target set, loop indefinitely, or silently retry uncertain writes.
