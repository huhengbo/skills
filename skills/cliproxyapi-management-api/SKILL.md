---
name: cliproxyapi-management-api
description: Comprehensive reference and operation workflow for CLIProxyAPI endpoints, including core OpenAI/Gemini-compatible APIs, management APIs, Amp proxy/provider routes, and provider CRUD payload schemas. Use when Codex needs to list available interfaces, explain endpoint behavior, or generate safe request examples for adding, updating, deleting, and querying providers without exposing secrets.
---

# CLIProxyAPI Management API

## Overview
Use this skill to enumerate CLIProxyAPI interfaces and to generate safe, sanitized request examples for management and provider operations.

## Workflow
1. Read `references/api-endpoints.md` to identify the exact route set and auth model.
2. Read `references/provider-management-schemas.md` when the task involves provider CRUD or config mutation.
3. Generate examples with placeholders only (`<BASE_URL>`, `<API_KEY>`, `<MANAGEMENT_KEY>`), never real secrets.
4. Prefer idempotent mutation flow: `GET` current value -> prepare diff -> `PUT`/`PATCH`/`DELETE` -> `GET` verify.
5. Call out route activation constraints before executing requests:
- `/v0/management/*` requires configured management key and management middleware enabled.
- Amp routes require Amp module/upstream to be configured.

## Output Rules
- Keep sensitive fields masked in all outputs.
- Preserve exact method and path.
- State auth header requirements explicitly for each example.
- When endpoint semantics are destructive, label them as such and suggest backup-first flow.

## Resources
- `references/api-endpoints.md`: Full available interface list grouped by module and path prefix.
- `references/provider-management-schemas.md`: Provider-related request body/query schema and safe CRUD playbook.
