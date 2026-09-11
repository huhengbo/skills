# Skill authoring guidance

## Keep the entry point small

`SKILL.md` is loaded to decide and start work, so keep it focused on trigger context, target resolution, execution flow, hard safety rules, result semantics, and links to detailed references.

Do not copy long API catalogs, service schemas, troubleshooting tables, or object-specific action matrices into the entry point when they already have a canonical reference file.

## One normative source per rule

A safety or lifecycle rule should have one authoritative location. The entry point may summarize it, but the detailed definition belongs in one reference. When behavior changes, update that source rather than maintaining parallel versions.

Historical design documents and implementation plans are non-normative. Do not make current behavior depend on an old plan when an active `SKILL.md` or reference defines the contract.

## References

Use `references/` for material that should be loaded only when the current task needs it, including:

- API endpoint catalogs and request schemas;
- service-specific command catalogs;
- detailed lifecycle/action matrices;
- authentication/setup details;
- troubleshooting and failure semantics;
- destructive/high-risk operation policy.

Link references from `SKILL.md` with clear task-specific descriptions so an agent knows when to read each one.

## Scripts

Add a script when the work is repetitive, deterministic, validation-heavy, or safer when encoded than repeatedly generated.

Canonical maintained scripts must run natively on Windows, macOS, and Linux. Prefer Python standard library or Node.js where practical. If a shell wrapper is useful for Unix users, keep the platform-neutral script as the canonical path and treat the wrapper as optional convenience.

Do not require WSL or Git Bash for Windows support.

## Platform-specific guidance

A command that is inherently cross-platform may be shown once. When environment-variable syntax, quoting, filesystem paths, credential entry, or process behavior differs by OS, provide equivalent Windows, macOS, and Linux guidance or use a platform-neutral helper.

## Safety defaults

- Keep secrets out of repositories, normal logs, generated examples, and user-visible diagnostics.
- Separate sanitized display output from restorable secret-bearing backups.
- Prefer read -> validate -> one write -> read/verify for mutations.
- Prefer narrow PATCH-like operations over full replacement.
- Detect concurrent changes before replacement when the service lacks conditional writes.
- Never infer destructive action from a request to inspect, explain, plan, or generate an example.
- Never automatically retry an uncertain write.

## Tests

Add regression tests for reproduced defects and important safety boundaries. Tests must not require production credentials or mutate live infrastructure.

Use repository validation before merging:

```text
python scripts/validate_repo.py --with-tests
```

The same command runs in CI on Windows, macOS, and Linux.
