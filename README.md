# skills

Reusable Agent Skills repository for standardized operations, API references, and automation workflows. Core skills follow the portable [Agent Skills specification](https://agentskills.io/specification); client-specific metadata is optional and never defines core behavior.

## Goals
- Maintain reusable, production-safe skills.
- Keep skill structure and quality consistent.
- Support long-term iterative updates.

## Repository Layout
```text
skills/
  <skill-name>/
    SKILL.md
    references/
    scripts/      (optional)
    assets/       (optional)
    agents/       (optional client adapter)
    .claude-plugin/ (optional client adapter)
```

## Skills
- `cliproxyapi-management-api`
  - Full CLIProxyAPI interface reference (core API, management API, Amp routes)
  - Provider CRUD schemas and safe request templates

- `aliyun-infra`
  - Standardized Aliyun CLI operations across profiles and regions
  - SMS/Dysmsapi workflows for signatures, templates, sending, delivery details, and statistics
  - Independent CAS certificate application/renewal, DNS validation, and OSS deployment workflows
  - Public TLS propagation verification for edge certificate rollouts
  - Safety-first workflow for mutating operations
  - Generic troubleshooting and command catalog

- `tencentcloud-infra`
  - Standardized TencentCloud `tccli` operations across profiles and regions
  - Safety-first workflow for mutating operations
  - Generic troubleshooting and command catalog

- `werss-official-account`
  - Search, subscribe, refresh, and summarize WeChat Official Account content through WeRSS
  - Generate RSS / Atom / JSON feed URLs for accounts, tags, and keyword feeds
  - Access Key based API wrapper for repeatable agent workflows

- `yunxiao-project-lifecycle`
  - Manage requirements, defects, tasks, assignees, comments, workflows, sprints, versions, and milestones through the official Yunxiao MCP
  - Bind a repository to one Yunxiao project through a portable root-level `yunxiao.toml`
  - Diagnose MCP, authentication, capabilities, and bindings on Windows, macOS, and Linux without storing credentials

## New Skill Workflow
1. Initialize skill skeleton with `skill-creator`.
2. Keep `SKILL.md` concise: trigger context + execution workflow.
3. Put detailed technical material into `references/`.
4. Add scripts only for repetitive or deterministic tasks.
5. Validate each portable skill with the Agent Skills reference command `uvx --from skills-ref agentskills validate <skill-dir>`; use client-specific validators only as additional checks.

## Naming Rules
- Use lowercase letters, digits, and hyphens (kebab-case).
- Example: `aliyun-infra`.

## Security Rules
- Never commit secrets, tokens, cookies, authorization headers, or private endpoints.
- Use placeholders for account, organization, project, and user IDs in reusable Skill examples. Consumer repositories may version stable binding IDs only when their own data-classification policy permits it.
- Mark destructive operations and require explicit confirmation in skill workflows.

## Maintenance Rules
- Keep each commit focused on one skill or one update theme.
- Update related `references/` whenever behavior or API surface changes.
- Remove stale or duplicated skill content regularly.
