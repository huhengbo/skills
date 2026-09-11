---
name: cliproxyapi-management-api
description: Comprehensive reference and operation workflow for CLIProxyAPI endpoints, including core OpenAI/Gemini-compatible APIs, management APIs, Amp proxy/provider routes, and provider CRUD payload schemas. Use when Codex needs to list available interfaces, explain endpoint behavior, generate safe request examples, or perform explicitly requested provider mutations without exposing secrets or overwriting concurrent changes.
---

# CLIProxyAPI Management API

## Overview
Use this skill to enumerate CLIProxyAPI interfaces, generate sanitized examples, and perform narrowly scoped provider mutations with explicit safety checks.

## Workflow
1. Read `references/api-endpoints.md` to identify the exact route set and auth model.
2. Read `references/provider-management-schemas.md` when the task involves provider CRUD or config mutation.
3. Distinguish **example generation** from **real execution**. A request to explain or generate `curl` must remain read-only.
4. For real provider writes, read `references/safe-mutations.md` and prefer `scripts/provider_mutation.py` over ad hoc `curl`.
5. Prefer narrow PATCH operations when supported. Whole-list PUT requires an explicitly reviewed state hash and explicit replacement confirmation.
6. After every allowed write, re-read the collection and verify the requested change. Never automatically retry an uncertain write.

## Safety Rules
- Keep sensitive fields masked in all normal output.
- Preserve exact method and path in examples, but use placeholders only (`<BASE_URL>`, `<API_KEY>`, `<MANAGEMENT_KEY>`).
- Never print management keys or provider keys from live responses.
- Treat restorable provider backups as secret material; keep them outside the repository and normal logs.
- Abort on concurrent remote changes instead of silently replacing a stale provider list.
- Destructive deletion or whole-list replacement requires explicit target/action confirmation.
- `/v0/management/*` requires configured management key and management middleware enabled.
- Amp routes require the Amp module/upstream to be configured.

## Cross-platform execution
Canonical mutation automation uses Python standard-library APIs and must work natively on Windows, macOS, and Linux. Bash/WSL is not required.

## Resources
- `references/api-endpoints.md`: interface list grouped by module and path prefix.
- `references/provider-management-schemas.md`: provider request schemas and CRUD semantics.
- `references/safe-mutations.md`: conflict-aware execution, backups, confirmations, and verification.
- `scripts/provider_mutation.py`: cross-platform helper for snapshot, PATCH, and guarded full-list replacement.
