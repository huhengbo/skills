# skills

Reusable Codex Skills repository for standardized operations, API references, and automation workflows.

## Goals
- Maintain reusable, production-safe skills.
- Keep skill structure and quality consistent.
- Support long-term iterative updates.

## Repository Layout
```text
skills/
  <skill-name>/
    SKILL.md
    agents/
      openai.yaml
    references/
    scripts/      (optional)
    assets/       (optional)
```

## Skills
- `cliproxyapi-management-api`
  - Full CLIProxyAPI interface reference (core API, management API, Amp routes)
  - Provider CRUD schemas and safe request templates

- `aliyun-infra`
  - Standardized Aliyun CLI operations across profiles and regions
  - Safety-first workflow for mutating operations
  - Generic troubleshooting and command catalog
  - Sanitized DevOps activity aggregation script

## New Skill Workflow
1. Initialize skill skeleton with `skill-creator`.
2. Keep `SKILL.md` concise: trigger context + execution workflow.
3. Put detailed technical material into `references/`.
4. Add scripts only for repetitive or deterministic tasks.
5. Validate each skill with `quick_validate.py` before commit.

## Naming Rules
- Use lowercase letters, digits, and hyphens (kebab-case).
- Example: `aliyun-infra`.

## Security Rules
- Never commit secrets, tokens, account IDs, org IDs, or internal addresses.
- Use placeholders in examples (for example `<BASE_URL>`, `<API_KEY>`, `<profile>`).
- Mark destructive operations and require explicit confirmation in skill workflows.

## Maintenance Rules
- Keep each commit focused on one skill or one update theme.
- Update related `references/` whenever behavior or API surface changes.
- Remove stale or duplicated skill content regularly.
