---
name: tencentcloud-infra
description: Standardized Tencent Cloud operations via the official TencentCloud CLI (`tccli`) for multi-profile and multi-region environments. Use when Codex needs to list, inspect, troubleshoot, or change Tencent Cloud resources (CVM/Lighthouse/VPC/CLB/TKE/CDB/DNSPod/COS) while safely resolving profile, region, permissions, and destructive-operation confirmations.
---

# TencentCloud Infra

## Overview
Use this skill to execute `tccli` operations with consistent safety controls, profile/region resolution, and sanitized outputs.

## Execution Workflow
1. Classify request type:
- Read-only: `Describe*`, `List*`, `Get*`
- Mutating: start/stop/reboot/create/modify/delete/terminate
2. Resolve profile:
- Check user-provided account alias.
- If alias mapping is needed, load `references/account-aliases.template.md`.
- If ambiguous, ask user to choose the exact `--profile`.
3. Resolve region:
- Prefer explicit user region.
- Else use profile default region.
- If still unclear and operation is mutating, ask before execution.
4. Validate identity before sensitive operations:
```bash
tccli sts GetCallerIdentity --profile <profile>
```
5. For mutating operations, show the planned `tccli` command and request explicit confirmation.
6. Execute and summarize: profile, region, target, and result.

## Safety Rules
- Default to read-only operations.
- Never expose keys, secrets, token values, account IDs, or organization IDs.
- Use placeholders in examples: `<profile>`, `<region>`, `<resourceId>`, `<domain>`.
- For destructive operations, require explicit confirmation.
- Prefer scoped changes over bulk operations.

## Command Selection
Load `references/command-catalog.md` for service commands and safe examples.

## Troubleshooting
Load `references/troubleshooting.md` for profile/auth/region/permission failures.

## Improvement Backlog
Load `references/improvement-checklist.md` when planning next updates.
