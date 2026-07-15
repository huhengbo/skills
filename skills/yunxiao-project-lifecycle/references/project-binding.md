# Project binding contract

## Purpose

Use one repository-root `yunxiao.toml` as the sole mapping between a local project and a Yunxiao project. Every compatible agent, CI job, and future synchronizer must read this file instead of maintaining its own project mapping.

## Locate the project root

1. Starting at the active working directory, use the nearest enclosing Git repository root.
2. If there is no Git repository, use the active agent workspace root.
3. Read only `<project-root>/yunxiao.toml`.
4. A nested Git repository never inherits the outer repository's binding.
5. Schema version 1 supports exactly one Yunxiao project per local project.

## Schema version 1

```toml
schema_version = 1

[organization]
id = "<organization-id>"
name = "<organization-display-name>"

[project]
id = "<project-id>"
name = "<project-display-name>"
custom_code = "<project-code>"

[workitem_types.requirement]
id = "<requirement-type-id>"
name = "<requirement-type-name>"

[workitem_types.bug]
id = "<bug-type-id>"
name = "<bug-type-name>"

[workitem_types.task]
id = "<task-type-id>"
name = "<task-type-name>"

[assignees.requirement]
user_id = "<product-owner-user-id>"
name = "<product-owner-display-name>"

[assignees.bug]
user_id = "<bug-owner-user-id>"
name = "<bug-owner-display-name>"

[assignees.task]
user_id = "<task-owner-user-id>"
name = "<task-owner-display-name>"
```

Replace placeholders before using the file. The bundled parser deliberately rejects placeholder values.

## Field rules

- Required: `schema_version`, `organization.id`, `project.id`.
- Optional human-verification snapshots: `organization.name`, `project.name`, `project.custom_code`.
- Optional default type maps: `workitem_types.requirement`, `workitem_types.bug`, `workitem_types.task`. Each configured table requires both `id` and `name`.
- Optional default routing: `assignees.requirement`, `assignees.bug`, `assignees.task`. Each configured table requires both `user_id` and `name`.
- Do not store status IDs, sprint IDs, or version IDs. Discover them from current project state.
- Do not store tokens, AccessKeys, cookies, MCP URLs, authorization headers, client paths, or client configuration.
- Treat IDs as internal metadata, not credentials. A team may commit the file for shared behavior or ignore it when project identifiers are confidential; never decide that policy silently.

## Resolution precedence

1. A target explicitly named by the user for the current request.
2. A configured default whose stable ID and display snapshot still validate remotely.
3. Dynamic discovery that returns exactly one candidate.

An explicit user target overrides a default but must still resolve uniquely. Zero or multiple candidates stop the write.

## Validate before every write

1. Parse the file and require schema version 1.
2. Call the current MCP with `organization.id` and `project.id` and verify the returned project ID.
3. Compare configured display snapshots with current remote values. A name/code mismatch may be a legitimate rename, but it blocks writes until the user confirms and updates the binding.
4. Verify every configured type belongs to the bound project and retains the configured category.
5. Verify every configured assignee is an enabled organization member and can be assigned in the project.

Never use the current/last organization, a project name, or recent history as an implicit write binding.

## Create a binding

When the file is missing:

1. Perform read-only identity, organization, and project discovery.
2. Present stable project candidates with display names and codes.
3. Require the user to select one project explicitly.
4. Discover optional type and assignee defaults; ask only when multiple candidates materially affect future behavior.
5. Show the proposed placeholder-free TOML and create it only after the user requests the binding.
6. Re-read and remotely validate it before the first Yunxiao write.

Do not create a binding merely because the user asked to inspect available projects.

## Parser scope

`scripts/lib/binding.mjs` is a strict parser for this schema, not a general TOML implementation. It accepts quoted strings, integer `schema_version`, supported tables, and comments. It rejects unknown tables/keys, duplicates, malformed strings, control characters, missing paired fields, unsupported versions, and placeholder values.
