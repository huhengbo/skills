# skills

Reusable Agent Skills for standardized operations, API references, and automation workflows. Core behavior follows the portable Agent Skills model; client-specific metadata is an adapter layer and must not redefine the skill.

## Repository model

```text
skills/
  <skill-name>/
    SKILL.md             task entry point
    references/          detailed normative/reference material
    scripts/             optional deterministic helpers
    tests/               optional skill-local regression tests
    assets/              optional static assets
    agents/              optional client adapter
    .claude-plugin/      optional Claude adapter
```

`skills-manifest.json` is the canonical inventory for maintained skill names, versions, and distribution modes. `.claude-plugin/marketplace.json` and per-skill plugin metadata must agree with it.

## Maintained skills

- `aliyun-infra` — Aliyun CLI operations, SMS, CAS certificates, DNS/OSS deployment, and safe infrastructure workflows.
- `cliproxyapi-management-api` — CLIProxyAPI endpoint reference and guarded provider-management workflows.
- `tencentcloud-infra` — TencentCloud `tccli` operations with profile/region and mutation safety controls.
- `werss-official-account` — WeRSS-powered WeChat Official Account search, subscription, article research, and feed URLs.
- `yunxiao-project-lifecycle` — Yunxiao project/Codeup/pipeline/package/application/test lifecycle management and project binding.

## Progressive disclosure

Keep `SKILL.md` small enough to load for routine tasks. It should define:

- when the skill applies;
- how to resolve context and targets;
- the high-level execution workflow;
- hard safety gates and result semantics;
- which reference to load for detailed rules.

Put service catalogs, schemas, long command tables, operation matrices, troubleshooting, and detailed object-specific policy in `references/`. Each normative rule should have one clear source of truth instead of being copied between `SKILL.md` and reference files.

See [authoring guidance](docs/authoring.md).

## Cross-platform policy

Maintained skills and canonical helper scripts must support **Windows, macOS, and Linux**. WSL or Git Bash is not considered native Windows support.

Prefer Python or Node.js for executable cross-platform helpers. A `.sh` script may remain as a convenience wrapper only when an equivalent canonical platform-neutral path exists. Shell-specific setup examples must have equivalent guidance for other supported platforms when the commands materially differ.

## Validation

Run the same repository-wide checks used by CI:

```text
python scripts/validate_repo.py --with-tests
```

The command validates skill structure, local references, distribution metadata, secret hygiene, `.gitignore` policy, and all discovered Python/Node tests. GitHub Actions executes the same command on Windows, macOS, and Linux. See [validation details](docs/validation.md).

For an individual portable skill, the Agent Skills reference validator may also be used when available:

```text
uvx --from skills-ref agentskills validate <skill-dir>
```

## Security and mutation rules

- Never commit secrets, tokens, cookies, authorization headers, private keys, or secret-bearing backups.
- Use placeholders in reusable examples; keep environment/project bindings separate from reusable skill content.
- Read current state before a mutation and verify state afterward when the external system allows it.
- Destructive or high-impact actions must require explicit target/action intent.
- Never retry an uncertain write until a read establishes whether the side effect occurred.
- Prefer narrow updates over whole-object/list replacement, and detect concurrent state changes where possible.

## Maintenance

- Keep commits focused on one skill or one update theme.
- Update the canonical reference when an API or safety rule changes instead of duplicating the same rule in multiple files.
- Add regression tests for reproduced failures before or alongside fixes.
- Keep `skills-manifest.json`, marketplace metadata, and per-skill version metadata synchronized.
- Remove stale examples and historical assumptions from normative skill files; keep design/history documents clearly non-normative.
