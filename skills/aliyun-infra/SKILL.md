---
name: aliyun-infra
description: Standardized Alibaba Cloud (Aliyun) operations via aliyun CLI for multi-profile and multi-region environments. Use when Codex needs to list, inspect, troubleshoot, or change Aliyun resources and cloud services (ECS/OSS/CDN/SAE/ACK/Alidns/RDS/VPC/DevOps/SMS/Dysmsapi/CAS), including independent SSL certificate application or renewal, DNS ownership validation, CAS deployment of an existing certificate to OSS custom domains, TLS propagation checks, sending SMS messages, querying SMS signatures/templates/qualification, checking SMS delivery records, or reporting SMS statistics. Safely resolve profile, region, permissions, billable side effects, private-key exposure, and destructive-operation confirmations.
---

# Aliyun Infra

## Overview
Use this skill to run Aliyun CLI operations with consistent safety controls, profile and region resolution, and sanitized outputs.

## Execution Workflow
1. Classify request type first:
- Read-only: `Describe*`, `List*`, `Get*`
- Mutating: start/stop/reboot/add/update/delete/refresh/restart/resize
- Certificate mutation: request/renew certificate, write DNS verification record, deploy/rollback certificate
- Billable external action: SMS send/batch send
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
5. For mutating operations, always provide planned command and request confirmation before execution. A free certificate is still an external order/application and needs confirmation.
6. Execute commands and summarize: profile, region, scope, and outcome. Do not expose raw signed requests, contact details, certificate private keys, access keys, tokens, or account IDs.

## Safety Rules
- Default to read-only operations.
- Never expose access keys, secrets, token values, account IDs, or organization IDs.
- Treat SMS sending as a billable external communication: require explicit recipients, signature, template, template params, and final confirmation before sending.
- Treat certificate issuance/renewal, DNS record creation, and certificate deployment as independent mutations. A single confirmation may cover only the actions requested by the user, with every target domain, DNS zone, certificate type, cloud resource, and deployment action named explicitly.
- Never call `cas GetUserCertificateDetail` without `--CertFilter true`; its default response can contain certificate and private-key material.
- Never use CLI `--dryrun` as a user-visible preview for signed Aliyun requests: it can print signed request material. Show a redacted, placeholder-based planned command instead.
- Treat a mixed result from repeated TLS handshakes as propagation in progress, not as permission to create another certificate or deployment task.
- Mask phone numbers in summaries unless the user explicitly asks for full raw command output.
- Never hardcode environment-specific values in outputs.
- Use placeholders in examples: `<profile>`, `<region>`, `<resourceId>`, `<orgId>`.
- For destructive operations, require explicit confirmation and display rollback hints when possible.

## Command Selection
Load `references/command-catalog.md` for service commands and safe examples.
Load `references/sms.md` for SMS/Dysmsapi sending, signature/template discovery, delivery queries, and statistics.
Load `references/cas-oss-certificates.md` before every CAS, certificate, DNS-validation, OSS-custom-domain certificate deployment, or TLS-propagation request.

## Certificate and OSS Rule
Use the generic `aliyun cas <ApiName>` OpenAPI commands for CAS. A browser is not a prerequisite for a CAS-to-OSS deployment. Use the browser only if the API response requires a human action outside the CLI (for example, an email validation link) or if the current CLI/API does not expose a required field.

Do not use the deprecated `aliyun oss` command for object operations. Use `aliyun ossutil` (ossutil v2). Its `--profile` selects a profile from ossutil's own configuration file (normally `~/.ossutilconfig`), not necessarily an `aliyun configure` profile with the same name; list and verify ossutil profiles before executing a command. CAS deployment does not require ossutil. Resolve CAS, ossutil, and DNS profiles independently, and confirm that the OSS custom domain already exists before requesting the CAS resource list.

## Troubleshooting
Load `references/troubleshooting.md` for CLI auth/profile/region/permission failures.

## Improvement Backlog
Load `references/improvement-checklist.md` when planning next updates.
