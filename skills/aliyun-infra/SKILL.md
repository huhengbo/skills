---
name: aliyun-infra
description: Standardized Alibaba Cloud (Aliyun) operations via aliyun CLI for multi-profile and multi-region environments. Use when Codex needs to list, inspect, troubleshoot, or change Aliyun resources (ECS/OSS/CDN/SAE/ACK/Alidns/RDS/VPC/DevOps), and must safely resolve profile, region, permissions, and destructive-operation confirmations.
---

# Aliyun Infra

## Overview
Use this skill to run Aliyun CLI operations with consistent safety controls, profile and region resolution, and sanitized outputs.

## Execution Workflow
1. Classify request type first:
- Read-only: `Describe*`, `List*`, `Get*`
- Mutating: start/stop/reboot/add/update/delete/refresh/restart/resize
2. Resolve profile:
- Check user-provided account alias.
- If alias mapping is needed, load `references/account-aliases.template.md` and map alias to profile.
- If ambiguous, ask user to choose profile.
3. Resolve region:
- Prefer explicit user region.
- Else use profile default region.
- If still unclear and operation is mutating, ask before execution.
4. Validate identity and permissions before sensitive operations:
```bash
aliyun sts GetCallerIdentity --profile <profile>
```
5. For mutating operations, always provide planned command and request confirmation before execution.
6. Execute commands and summarize: profile, region, scope, and outcome.

## Safety Rules
- Default to read-only operations.
- Never expose access keys, secrets, token values, account IDs, or organization IDs.
- Never hardcode environment-specific values in outputs.
- Use placeholders in examples: `<profile>`, `<region>`, `<resourceId>`, `<orgId>`.
- For destructive operations, require explicit confirmation and display rollback hints when possible.

## Command Selection
Load `references/command-catalog.md` for service commands and safe examples.

## Troubleshooting
Load `references/troubleshooting.md` for CLI auth/profile/region/permission failures.

## DevOps Activity Aggregation
Use `scripts/devops_activity_last30d.py` for organization activity summaries.

## Improvement Backlog
Load `references/improvement-checklist.md` when planning next updates.
