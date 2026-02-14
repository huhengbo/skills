# Improvement Checklist

## Completed in this revision
- Removed environment-specific org/account details.
- Removed hardcoded absolute skill paths.
- Standardized placeholders and safety policies.
- Added generic profile alias template.
- Added troubleshooting and command catalog references.

## Next recommended improvements
1. Add service-specific scripts under `scripts/` for repetitive workflows (ECS inventory, DNS record diff, RDS snapshot report).
2. Add a machine-readable policy file for mutating command confirmation levels.
3. Add output normalization helpers for large JSON responses.
4. Add smoke-test script that validates required CLI operations in read-only mode.
5. Add changelog entries per skill update in repository-level release notes.
