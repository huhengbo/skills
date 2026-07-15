# Yunxiao Project Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a portable Agent Skill that manages Yunxiao project lifecycles through the official MCP, validates a repository-root `yunxiao.toml`, and diagnoses installation/authentication safely on Windows, macOS, and Linux.

**Architecture:** Keep the portable Skill declarative and client-neutral. Put deterministic project-binding, endpoint, doctor, and installer behavior in dependency-free Node.js modules with thin CLI entry points; keep lifecycle and setup policy in focused references. Treat `huhengbo/skills` as the canonical source while allowing callers to install the Skill into an explicitly supplied discovery directory.

**Tech Stack:** Agent Skills `SKILL.md`, Markdown/TOML contracts, Node.js 18+ ESM, Node built-in test runner, official Yunxiao Streamable HTTP MCP.

---

## File map

- `skills/yunxiao-project-lifecycle/SKILL.md`: trigger metadata, preflight, binding, lifecycle workflow, safety invariants, reference routing.
- `skills/yunxiao-project-lifecycle/references/project-binding.md`: exact `yunxiao.toml` schema and resolution/validation rules.
- `skills/yunxiao-project-lifecycle/references/mcp-setup.md`: official endpoint, capability gate, token safety, cross-platform setup and status model.
- `skills/yunxiao-project-lifecycle/references/lifecycle-policy.md`: read/write matrix, duplicate handling, workflow validation, post-write verification, result semantics.
- `skills/yunxiao-project-lifecycle/scripts/lib/binding.mjs`: strict parser/validator for the supported TOML subset.
- `skills/yunxiao-project-lifecycle/scripts/lib/doctor-core.mjs`: platform-neutral diagnostics with injectable environment and fetch.
- `skills/yunxiao-project-lifecycle/scripts/doctor.mjs`: CLI adapter for doctor-core.
- `skills/yunxiao-project-lifecycle/scripts/install.mjs`: explicit-target, dry-run-first portable installer.
- `skills/yunxiao-project-lifecycle/tests/*.test.mjs`: unit and CLI tests without live credentials.
- `README.md`: repository-neutral Agent Skills wording and Yunxiao entry.
- `docs/superpowers/specs/2026-07-15-yunxiao-project-lifecycle-design.md`: approved design.

### Task 1: Binding contract parser

**Files:**
- Create: `skills/yunxiao-project-lifecycle/scripts/lib/binding.mjs`
- Create: `skills/yunxiao-project-lifecycle/tests/binding.test.mjs`

- [x] **Step 1: Write failing parser tests**

Cover valid required sections, optional type/assignee sections, comments, duplicate keys, unknown schema versions, missing required fields, unsupported sections, placeholders, and malformed strings.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseBinding } from "../scripts/lib/binding.mjs";

test("parses the supported binding schema", () => {
  const binding = parseBinding(`schema_version = 1
[organization]
id = "org-1"
name = "Org"
[project]
id = "project-1"
name = "Project"
custom_code = "DEMO"
[workitem_types.bug]
id = "bug-type-1"
name = "Bug"
[assignees.bug]
user_id = "user-1"
name = "Owner"
`);
  assert.equal(binding.project.id, "project-1");
  assert.equal(binding.workitem_types.bug.id, "bug-type-1");
});

test("rejects a placeholder identifier", () => {
  assert.throws(() => parseBinding(`schema_version = 1
[organization]
id = "<organization-id>"
[project]
id = "project-1"
`), /placeholder/i);
});
```

- [x] **Step 2: Run tests and confirm the module is missing**

Run: `node --test skills/yunxiao-project-lifecycle/tests/binding.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [x] **Step 3: Implement the strict supported-subset parser**

Export `parseBinding(text)` and `readBinding(path)`. Parse only integer `schema_version`, quoted string values, and these sections: `organization`, `project`, `workitem_types.requirement|bug|task`, `assignees.requirement|bug|task`. Reject duplicates, unknown sections/keys, control characters, empty required IDs, placeholders, and schema versions other than `1`.

- [x] **Step 4: Run binding tests**

Run: `node --test skills/yunxiao-project-lifecycle/tests/binding.test.mjs`

Expected: all tests PASS.

### Task 2: Cross-platform doctor

**Files:**
- Create: `skills/yunxiao-project-lifecycle/scripts/lib/doctor-core.mjs`
- Create: `skills/yunxiao-project-lifecycle/scripts/doctor.mjs`
- Create: `skills/yunxiao-project-lifecycle/tests/doctor.test.mjs`

- [x] **Step 1: Write failing doctor-core tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { runDoctor } from "../scripts/lib/doctor-core.mjs";

test("reports TOKEN_MISSING without making a request", async () => {
  let called = false;
  const result = await runDoctor({
    env: {},
    platform: "linux",
    fetchImpl: async () => { called = true; throw new Error("unexpected"); },
    bindingText: null,
  });
  assert.equal(result.status, "TOKEN_MISSING");
  assert.equal(called, false);
  assert.equal(JSON.stringify(result).includes("Authorization"), false);
});

test("maps a 401 response to AUTH_FAILED", async () => {
  const result = await runDoctor({
    env: { ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN: "secret" },
    platform: "win32",
    fetchImpl: async () => new Response("{}", { status: 401 }),
    bindingText: null,
  });
  assert.equal(result.status, "AUTH_FAILED");
});
```

- [x] **Step 2: Run tests and confirm failure**

Run: `node --test skills/yunxiao-project-lifecycle/tests/doctor.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [x] **Step 3: Implement doctor-core**

Define the official endpoint constant, supported platforms (`win32`, `darwin`, `linux`), required MCP tool names, timeout handling, JSON/SSE response parsing, HTTP-to-status mapping, capability validation, token redaction, and binding diagnostics. Accept injected `env`, `platform`, `fetchImpl`, `bindingText`, and `timeoutMs` for deterministic tests. Never return headers or token-derived values.

- [x] **Step 4: Implement the CLI**

Support `--json`, `--project-root <path>`, `--platform <value>` for test-only branch injection, and `--help`. Read `<project-root>/yunxiao.toml` when present, call `runDoctor`, print one result, and exit `0` only for `READY`; use exit `2` for setup-required statuses and `1` for malformed input/internal failure.

- [x] **Step 5: Run doctor tests and syntax checks**

Run:

```bash
node --test skills/yunxiao-project-lifecycle/tests/doctor.test.mjs
node --check skills/yunxiao-project-lifecycle/scripts/doctor.mjs
node --check skills/yunxiao-project-lifecycle/scripts/lib/doctor-core.mjs
```

Expected: tests PASS and syntax checks produce no output.

### Task 3: Portable explicit-target installer

**Files:**
- Create: `skills/yunxiao-project-lifecycle/scripts/install.mjs`
- Create: `skills/yunxiao-project-lifecycle/tests/install.test.mjs`

- [x] **Step 1: Write failing installer CLI tests**

Use temporary directories and `spawnSync(process.execPath, ...)` to assert: missing target exits `2`; dry-run creates nothing; `--apply` copies the Skill; a second apply preserves a timestamped backup; targets equal to or inside the source are rejected; output never contains environment secrets.

- [x] **Step 2: Run tests and confirm failure**

Run: `node --test skills/yunxiao-project-lifecycle/tests/install.test.mjs`

Expected: FAIL because `install.mjs` is absent.

- [x] **Step 3: Implement installer**

Accept `--target`, `--apply`, `--json`, and `--help`; allow `AGENT_SKILLS_DIR` only when `--target` is absent. Resolve destination as `<target>/yunxiao-project-lifecycle`. Validate the source frontmatter name before any mutation. Dry-run by default. On apply, copy to a unique sibling temp directory, rename an existing destination to a unique backup, then rename temp to destination; restore the backup if installation fails. Reject filesystem roots, the source path, descendants of source, and control characters.

- [x] **Step 4: Run installer tests and syntax check**

Run:

```bash
node --test skills/yunxiao-project-lifecycle/tests/install.test.mjs
node --check skills/yunxiao-project-lifecycle/scripts/install.mjs
```

Expected: all tests PASS and syntax check produces no output.

### Task 4: Skill instructions and references

**Files:**
- Create: `skills/yunxiao-project-lifecycle/SKILL.md`
- Create: `skills/yunxiao-project-lifecycle/references/project-binding.md`
- Create: `skills/yunxiao-project-lifecycle/references/mcp-setup.md`
- Create: `skills/yunxiao-project-lifecycle/references/lifecycle-policy.md`

- [x] **Step 1: Write the portable SKILL.md**

Use only `name` and `description` frontmatter. Include Chinese and English trigger terms for Yunxiao/云效, requirements, defects, work items, milestones, sprints, versions, assignment, status, binding, MCP setup, and diagnostics. Route detailed setup, binding, and lifecycle decisions to one-level references.

- [x] **Step 2: Write the project binding contract**

Document repository/workspace root resolution, exact schema, required/optional fields, no-secret rule, user override precedence, remote revalidation, missing/mismatched binding behavior, and a placeholder-only TOML example.

- [x] **Step 3: Write MCP setup guidance**

Document the official hosted endpoint, Streamable HTTP, Bearer token environment variable, toolset restriction, Region header constraints, setup state machine, client-neutral capability discovery, Windows/macOS/Linux token-handling guidance, restart verification, and status/error mapping. Explicitly state that the Skill cannot install itself before discovery.

- [x] **Step 4: Write lifecycle policy**

Document the read → resolve → pre-read → validate → single write → post-read sequence; direct-write conditions; duplicate and timeout handling; workflow validation; result states; and v1 prohibitions on batch, delete, archive substitution, and scheduled writes.

### Task 5: Repository documentation and validation

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/specs/2026-07-15-yunxiao-project-lifecycle-design.md`

- [x] **Step 1: Update repository-neutral wording**

Change “Codex Skills” to “Agent Skills”, show `agents/` and `.claude-plugin/` as optional client adapters, add the Yunxiao Skill to the catalog, and make Agent Skills `skills-ref validate` the primary validator while retaining client validators as optional checks. Preserve existing skill descriptions.

- [x] **Step 2: Run static validation**

Run:

```bash
python3 /Users/huhengbo/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/yunxiao-project-lifecycle
node --test skills/yunxiao-project-lifecycle/tests/*.test.mjs
node --check skills/yunxiao-project-lifecycle/scripts/*.mjs
node --check skills/yunxiao-project-lifecycle/scripts/lib/*.mjs
rg -n -i 'pt-[A-Za-z0-9_-]+|authorization:\s*bearer\s+[^<]|access[_-]?key\s*=\s*[^<]' skills/yunxiao-project-lifecycle
```

Expected: validator succeeds; tests pass; syntax checks are silent; secret scan has no matches.

- [x] **Step 3: Validate against Agent Skills specification**

Run `uvx --from skills-ref agentskills validate skills/yunxiao-project-lifecycle` using the Agent Skills reference implementation. If unavailable, record the exact installation failure and keep `quick_validate.py` as secondary evidence rather than claiming reference validation.

### Task 6: Independent forward validation and publication

**Files:**
- Review: all files above

- [x] **Step 1: Forward-test read-only scenarios**

Use fresh agents with the raw Skill path and realistic prompts for missing MCP, missing binding, ambiguous assignee, duplicate work item, invalid transition, timeout uncertainty, and prohibited batch/delete/archive. No live write prompt is permitted during validation.

- [x] **Step 2: Review diff and rerun full checks**

Run:

```bash
git diff --check
git status --short
node --test skills/yunxiao-project-lifecycle/tests/*.test.mjs
```

Expected: no whitespace errors, only intended files changed, all tests PASS.

- [ ] **Step 3: Commit, push, and open a draft pull request**

Commit the focused change on `feat/yunxiao-project-lifecycle`, push to `origin`, and open a draft PR summarizing architecture, safety boundaries, tests, and known platform limits.
