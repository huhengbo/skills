# First-time setup

Use this when `aliyun` is missing, no usable profile exists, or the user is new to the skill. Skip any step that is already verified. Work on Windows (PowerShell), macOS (zsh), and Linux (bash); show only the user's platform. Tell the user up front what you need from them: the only secrets are AccessKey values, and they are typed locally, never pasted into chat or passed on a command line.

| Step | The user does | The user provides | How to verify |
|---|---|---|---|
| 1. Install CLI | Install `aliyun` ([below](#1-install-the-cli)) | Their OS | `aliyun version` prints a version |
| 2. Credentials | Create a RAM user/AccessKey or pick another mode ([below](#2-create-the-credential)) | Nothing in chat | — |
| 3. Profile | Run `aliyun configure` in their own terminal ([below](#3-create-a-profile-locally)) | Profile name, default region, which account/purpose | `aliyun configure list` shows `Valid` |
| 4. Identity | — | Confirmation it is the intended account | `aliyun sts GetCallerIdentity --profile <profile>` succeeds |
| 5. Plugins | Allow automatic plugin install | — | Service commands (for example `dysmsapi`) resolve |
| 6. Optional | Alias map; ossutil profile | Aliases; OSS account/region | See sections below |

Check current state first, without changing anything:

```text
aliyun version
aliyun configure list
```

`configure list` masks keys (`AK:***xyz`) and its `Valid` column shows whether a profile has usable credentials; a blank or `Invalid` row is not usable. Never open or print `config.json`: it stores secrets in plaintext.

## 1. Install the CLI

Source: `https://help.aliyun.com/zh/cli/install-update-alibaba-cloud-cli` and `https://github.com/aliyun/aliyun-cli`. Version 3.3.0 or newer is required for plugins (SMS and other plugin-backed services); versions below 3.3.0 are unmaintained.

| Platform | Install |
|---|---|
| macOS | `brew install aliyun-cli` (or the official PKG: `https://aliyuncli.alicdn.com/aliyun-cli-latest.pkg`) |
| Linux | `/bin/bash -c "$(curl -fsSL https://aliyuncli.alicdn.com/install.sh)"`, or download the amd64/arm64 TGZ from the official page, extract, and `sudo mv ./aliyun /usr/local/bin/` |
| Windows | Official support is AMD64 only (no 32-bit/ARM64). Download `https://aliyuncli.alicdn.com/aliyun-cli-windows-latest-amd64.zip`, extract `aliyun.exe` to a folder such as `C:\AliyunCLI`, and add that folder to the user `PATH`. Open a **new** PowerShell window afterwards |

Running a downloaded installer script is the user's decision; show them the exact command and let them run it. Upgrade later with the same method (`aliyun upgrade` needs 3.3.5+ and does not apply to Homebrew installs). Then verify with `aliyun version`.

## 2. Create the credential

Prefer short-lived or keyless modes when the user's environment supports them; use a long-lived AccessKey only as a fallback.

| Situation | Mode (`aliyun configure --mode ...`) |
|---|---|
| Personal workstation, browser available | `OAuth` (interactive; recommended) |
| Running on an Alibaba Cloud ECS with an instance role | `EcsRamRole` |
| Assuming a role from another identity | `RamRoleArn` |
| Fallback | `AK` with a RAM user's AccessKey |

For the `AK` fallback, the user creates it (the assistant cannot):

1. Open the RAM console: `https://ram.console.aliyun.com/`.
2. **身份管理 → 用户**: create a RAM user for this purpose (or open an existing one). Do not use the Alibaba Cloud account's root AccessKey.
3. Attach least-privilege permissions ([below](#permissions)).
4. On the user's page, open the credential tab (labelled **凭证管理** or **认证管理**, depending on the console version) → **创建 AccessKey**.
5. Copy the AccessKey ID and Secret right away; the Secret is shown once. Each RAM user can hold at most two AccessKeys, which allows rotation.

## 3. Create a profile locally

The user runs this in their own terminal, not through the assistant, so the secret never enters the conversation:

```text
aliyun configure --mode AK --profile <profile>
```

It prompts for AccessKey ID, AccessKey Secret, and default region. For other modes use the matching `--mode` and answer the prompts. Choose profile names that describe purpose (for example `personal`, `prod`, `prod-dns`), because the skill maps user wording to profile names.

Do not use the non-interactive form (`aliyun configure set --access-key-secret ...`) for a human setup: it leaves the secret in shell history. It is acceptable only in CI with a secret injected by the CI system.

Credentials live in `~/.aliyun/config.json` (Windows: `%USERPROFILE%\.aliyun\config.json`). Never print it, commit it, or copy it into a project.

## 4. Verify identity

```text
aliyun configure list
aliyun sts GetCallerIdentity --profile <profile>
```

The identity response contains the account ID. Confirm the account with the user by purpose and RAM user name, and do not repeat the account ID in the summary.

If the user has several profiles, ask which one applies, and keep CAS, DNS, and OSS profiles separate when they belong to different accounts.

## 5. Plugins

Plugin-backed services (for example SMS `dysmsapi`) install on demand. Ask the user before enabling automatic installation, since it downloads code:

```text
aliyun configure set --auto-plugin-install true
```

Official reference: `https://www.alibabacloud.com/help/en/cli/managing-and-using-cli-plugins`. Manual alternative: `aliyun plugin install --names <plugin>`. Environment variable equivalent: `ALIBABA_CLOUD_CLI_PLUGIN_AUTO_INSTALL=true`.

## Permissions

`sts GetCallerIdentity` needs no RAM permission, so it is always the first check. Beyond that, grant per scenario and start read-only; add write permission only for the task at hand:

| Scenario | Service to authorize | Note |
|---|---|---|
| Inventory/troubleshooting | ECS, VPC, RDS, SAE/ACK, CDN, OSS (read) | `Describe*`, `List*`, `Get*` |
| Certificates | CAS (certificate management) | Needs write for order/renew/deploy |
| DNS validation | Alidns | Write needed to add the validation record, possibly on a different account than CAS |
| OSS custom-domain deployment | CAS plus access to the OSS bucket/domain | Deployment goes through CAS, not ossutil |
| SMS | Dysmsapi | Send is billable; query actions are read-only |
| Billing | BSS OpenAPI | Read-only queries |

I did not verify exact system policy names or action strings against official documentation; look them up in the RAM console policy list. When a command returns `NoPermission`/`Forbidden`, the error names the denied action: give that exact action to the user so they can attach a least-privilege policy ([troubleshooting](troubleshooting.md#permission-denied)).

## Optional: account aliases

Copy `account-aliases.template.md` to `account-aliases.md` in the same directory (git-ignored) and replace the sample rows with the user's real profile names. The file holds names only, never keys. Without it, resolve the profile from `aliyun configure list` and ask the user to choose.

## Optional: ossutil profile

`aliyun ossutil` keeps its own profiles (`~/.ossutilconfig`; Windows: `%USERPROFILE%\.ossutilconfig`), independent of `aliyun configure`. List them with `aliyun ossutil config list-profiles`. Creating one is a local change to a credential file: confirm the account, region, and file path with the user, then have them run `aliyun ossutil config` in their own terminal. CAS-to-OSS certificate deployment does not need ossutil.

## SMS prerequisites

Sending needs an approved signature and template, and possibly an approved qualification, all created in the Alibaba Cloud SMS console by the user. See [sms.md](sms.md) before sending anything.
