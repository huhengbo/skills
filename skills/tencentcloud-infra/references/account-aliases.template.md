# TencentCloud Account Alias Template

Use this file as a sanitized alias map for local environments.
Do not commit real account names, account IDs, emails, or internal organization labels.

## Template
- alias: personal
  profile: personal
  notes: personal environment

- alias: production
  profile: prod
  notes: production account profile

- alias: dns
  profile: prod-dns
  notes: DNS-focused profile

## Usage
1. Match user language aliases (for example: "prod", "online", "dns").
2. Convert alias to `--profile` value.
3. If mapping is missing, ask user to specify profile explicitly.
