# Work-item practices

Load this file before registering or reorganizing requirements, defects, or tasks: imports from a spreadsheet or review, retitling, hierarchy, dependencies, backlog, versions, or project automation rules.

If the bound repository documents its own work-item convention (check `AGENTS.md`, `CLAUDE.md`, and `docs/`), that convention wins over section 2. Section 1 describes platform behavior and applies everywhere.

## 1. Platform behavior

Observed on Yunxiao Projex in 2026-11. Re-check with the named read tool when a call contradicts it.

### Relations

- Types: `PARENT`, `SUB`, `ASSOCIATED`, `DEPEND_ON`, `DEPENDED_BY`. With `create_workitem_relation_record`, `workItemId` is the parent and `relatedWorkItemId` the child for `SUB`.
- Allowed pairs are type-constrained. Before creating, call `list_work_item_relation_work_item_types` with the source type and relation type. An empty list means the relation is impossible.
- `DEPEND_ON` / `DEPENDED_BY` are limited to request and topic categories (客户诉求, 用户反馈, 产品主题). Requirement-to-requirement dependency fails with 400 `不满足关系对应的类型约束`. Record prerequisites as section 2 describes.
- Defects cannot have a parent: their `PARENT` type list is empty. Requirements accept requirements and tasks as children.
- `ASSOCIATED` has no direction. It appears on both items, so the relation alone cannot tell which side is the prerequisite.

### Creation and status

- A new work item always starts in the workflow's initial status. Reaching another status (for example a backlog status added later) takes a separate legal transition after creation.
- A status added in the workflow editor does not become the initial status unless someone sets it in the UI.
- Status IDs are per project and per type; requirement and defect workflows do not share IDs. Resolve them with `get_work_item_workflow`.

### Search and content

- `search_workitems` and OpenAPI `workitems:search` are scoped to one category (`Req`, `Bug`, `Task`). A serial lookup must query each category.
- Serial search uses `CONTAINS`, so `X-1` also matches `X-12`. Compare the serial exactly.
- Descriptions accept Markdown (`formatType: MARKDOWN`).
- Images: upload with `create_workitem_attachment`, then put the returned `embedMarkdown` into the description. The returned `url` is temporary.

### What needs the web UI

The MCP and the documented OpenAPI cannot create labels, custom fields, workflow statuses, automation rules, or roadmap entries. Change these in the project settings UI, through a browser session the user has logged into, and only on an explicit request. Read the page before changing anything.

### Roadmap and milestones

- The roadmap is a Gantt view of requirements by their planned start and end fields. It holds no separate content.
- Milestones have their own OpenAPI under `/projects/{id}/milestones`.

### Automation rules

Configured in Project settings → 自动化.

- **Parent-child triggers**:
  - A parent change can update its children.
  - "All children reach status X" can update the parent; several target statuses may be selected.
  - There is no "a child started" → update parent trigger.
- **Field-change triggers**: fire on any change of the field, including clearing it. Add a current-status condition to narrow them.
- **Member-field conditions**: offer only include / exclude a specific member. "Is empty" is not available, so a default-assignee rule would overwrite an explicit choice.
- **Timed triggers**: only "date field reaches today, 09:00" and sprint dates.
- **Actions**: no "add comment" action. Available actions are change status or field, update children, notifications, group bots, and webhooks.

## 2. Default registration conventions

Use these when the project has no convention of its own.

### Requirement or defect

Decide with one question: did the expected behavior change?

- New or changed expectation → requirement.
- Unchanged expectation, but the released or delivered behavior differs → defect, whoever found it.
- Problems found in self-testing work that was never delivered belong in that requirement's acceptance checklist, not in a defect.
- A defect fixed before it was registered is still registered. Set it directly to the fixed status, with the commit and release in a comment.

### Hierarchy

Three levels of the same requirement type:

1. **Product**: the root.
2. **Capability**: a long-lived area of the product.
3. **Scenario**: the deliverable requirement.

Rules:

- Product and capability items are containers. They carry no version, and their status follows the earliest stage among active children.
- Tasks are children of scenarios.
- Defects are associated with the requirement they violate, because they cannot have a parent.
- Siblings are not associated with each other, except for prerequisites.

### Prerequisites

When A cannot be built or verified before B:

- Associate A with B.
- Add a `Prerequisites` section to A's description: "B title — why A needs it".
- Write prerequisites outside Yunxiao (vendor documents, another team's work) as text and mark them external.

### Titles

- Plain language a non-developer understands.
- No class names, status codes, or internal jargon.
- About 25 characters or fewer for CJK titles, with a `Module: ` prefix.
- Requirement: "who can achieve what".
- Defect: "what goes wrong and the consequence".
- Put environment, reporter, and review IDs in the description, not in the title.

### Descriptions

**Requirement sections:**
- Background: why, the current state, who is affected.
- Scenario.
- Prerequisites.
- Acceptance checklist.
- Decisions: settled only, with dates.
- Release notes.
- Out of scope: list future items as their own backlog requirements by ID.

**Defect sections:**
- Symptom: plain language, including how it was found.
- Impact: money, orders, users, scope.
- Cause: verified against code or the fix commit, cited as `path:line`; write "unknown" rather than guess.
- Reproduction steps.
- Evidence: logs, screenshots, curl.
- Fix.

**Evidence rules:**
- curl uses `$HOST` and `$TOKEN` placeholders.
- Never paste real keys, tokens, phone numbers, or ID numbers.
- Mask screenshots.
- Mark unverified claims as unverified.

### Backlog, versions, labels

- Keep a separate backlog status for recorded but uncommitted work. It has no version and no planned dates.
- Committing an item means attaching a version and planned dates, then moving it to the to-do status.
- One version per initiative. Sprints only if the team actually runs them.
- Labels for a single dimension, such as which client surfaces are touched. Module goes in the title prefix.

### Automation

Few rules, each one replacing a step people forget:

- **"All children completed or cancelled → parent completed".** Containers with backlog children never trigger it.
- **"Version changed while in backlog → to-do".** Clearing the version also fires it, so when withdrawing a commitment, move the status back first and clear the version after.

Avoid these:

- Commit-driven status changes: a commit is not verification.
- Reminders, for small teams.
- Relation-driven rules: an association cannot express direction.

## 3. Batch registration workflow

1. **Plan:** list every item with its type, title, parent, status, version, and relations, then get the user's approval of that list.
2. **Check for duplicates:** search existing items by title keywords and reuse a match instead of creating a new item.
3. **Create:** one item at a time with the MCP. Then transition the status if the target is not the initial one.
4. **Fill fields and relations:** use the MCP for fields. Use `scripts/workitems.mjs` for associations, hierarchy, and description rewrites; dry run first, then `--apply`.
5. **Verify:** read everything back and print the hierarchy with `node scripts/workitems.mjs tree <root>`. Check titles against the length limit.
6. **Report:** created and changed IDs, the resulting tree, inferred or unverified content, and any UI-only follow-ups.
