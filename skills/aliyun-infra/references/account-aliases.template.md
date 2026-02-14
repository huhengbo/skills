# Account Alias Template

Use this file as a sanitized alias map for local environments.
Do not commit real account names, IDs, emails, or internal org names.

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
1. Match user language aliases (for example: "prod", "production", "online").
2. Convert alias to `--profile` value.
3. If no mapping exists, ask user which profile to use.
