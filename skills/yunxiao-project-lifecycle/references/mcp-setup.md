# MCP setup and diagnostics

## First-time setup (what the user does)

Walk the user through these in order and skip any step already verified. Tell them in advance what you need from them; the only secret is the token, and it is entered locally, never in chat.

| Step | The user does | The user provides | How to verify |
|---|---|---|---|
| 1. Token | Create a personal access token ([Get the token](#get-the-token)) | Nothing in chat; enter it locally ([Safe local token entry](#safe-local-token-entry)) | Doctor no longer reports `TOKEN_MISSING` |
| 2. MCP | Add the hosted MCP to the agent client ([Configure the MCP in your client](#configure-the-mcp-in-your-client)) | Which client they use (Claude Code, Cursor, Codex, ...) | `MCP_MISSING` clears; Yunxiao tools are listed in a **new** client process |
| 3. Project | Pick the Yunxiao project this repository maps to ([Where to find IDs](#where-to-find-ids)) | Project choice from candidates you discover; whether to commit `yunxiao.toml` | Doctor reports `READY` |

Run `node scripts/doctor.mjs --project-root <project-root>` after each step; failures print `Next steps`. Instructions work on Windows (PowerShell), macOS (zsh), and Linux (bash); show only the user's platform, detected from the OS, not guessed.

If the Yunxiao MCP is missing, do not stop at "unavailable": run steps 1 and 2 with the user, then ask them to restart the client and verify again.

## Get the token

Only the user can create it. Send them to:

1. Sign in to the Yunxiao workbench (`https://devops.aliyun.com`, using the Alibaba Cloud account that belongs to the organization).
2. Click the avatar at top right → **个人设置** → **个人访问令牌** → **新建访问令牌**.
3. Set a name (for example `agent-skill`), choose an expiry (do not use a never-expiring token; pick a period the user is willing to rotate), tick the scopes below, then click **新建**.
4. Copy the token immediately; it is displayed only once. Enter it locally as described in [Safe local token entry](#safe-local-token-entry).

Official reference: `https://help.aliyun.com/zh/yunxiao/developer-reference/obtain-personal-access-token` (also `https://help.aliyun.com/zh/yunxiao/user-guide/personal-access-token`; sign-in help: `https://help.aliyun.com/zh/yunxiao/user-guide/personal-account-and-login`). The official page documents the menu path above but no direct link, no fixed list of expiry options, and no list of permission points, so follow the live form. Its security guidance, which the user should follow:

- A token acts with the creator's own access, further limited by the scopes ticked; grant the minimum, and keep the expiry as short as is practical.
- Treat it like a password: do not share it through chat, email, or IM, do not pass it in plaintext on a command line, and do not commit it. Store it in an environment variable.
- If it leaks, delete the token in 个人访问令牌 immediately and create a new one.

An expired or revoked token surfaces as `AUTH_FAILED` (HTTP 401, "invalid or expired Yunxiao access token"). Fix it by creating a new token and replacing it everywhere it is stored: the environment variable and any client MCP config that embeds an `Authorization` header.

## Token scopes

The hosted MCP URL enables seven toolsets; the token needs read/write permission on the matching Yunxiao modules, otherwise calls in that toolset fail with `PERMISSION_DENIED`:

| Toolset in the URL | Token module (新版令牌权限) | Needed for |
|---|---|---|
| `organization-management` | 组织管理 | identity, organizations, members (always needed) |
| `project-management` | 项目协作 | projects, work items, sprints, versions |
| `code-management` | 代码管理 | repositories, branches, files, merge requests |
| `pipeline-management` | 流水线 | pipelines, runs, logs |
| `packages-management` | 制品仓库 | package repositories, artifacts |
| `application-delivery` | 应用交付 | applications, deployments |
| `test-management` | 测试管理 | test cases, plans, results |

The official MCP README asks for read/write on all of these modules; the per-toolset mapping above is inferred from the module names, not documented. To grant less, remove the unneeded toolsets from the `toolsets=` list in the MCP URL **and** leave the matching modules unchecked, and tell the user which capabilities are then unavailable. Ask for read-only scopes first when the user only wants inspection.

## Where to find IDs

Do not ask the user to hunt for IDs unless discovery fails; the MCP can list them once the token works.

| Data | Preferred: discover via MCP | Manual: where the user looks |
|---|---|---|
| Organization ID | `get_user_organizations` / `get_current_organization_info` | Admin console (头像 → **管理后台**) → **基本信息**; visible to organization owners and admins only |
| Project ID | `search_projects` (use the returned `id`) | The console's **项目编号** may not equal the API `id`; always confirm with `search_projects` |
| Repository, pipeline, work item type, member IDs | The matching `list_*` / `search_*` tool | Not needed from the user |

Present candidates by display name and code, let the user choose, and write only the chosen IDs into `yunxiao.toml` ([project binding](project-binding.md)).

## Official service contract

Prefer the Alibaba Cloud hosted Yunxiao MCP service:

```text
URL: https://openapi-rdc.aliyuncs.com/ai/mcp?toolsets=organization-management,project-management,code-management,pipeline-management,packages-management,application-delivery,test-management
Transport: Streamable HTTP (stateless)
Authentication: Authorization: Bearer <ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN>
```

Use `ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN` as the primary environment-variable name. Accept `YUNXIAO_ACCESS_TOKEN` only as a legacy alias to the same secret. If both exist with different values, report `CONFIG_ERROR` without making a network request. Never pass a token in the query string. For a dedicated Region installation, keep the hosted MCP URL and add `X-Yunxiao-Api-Base-Url` only for an HTTPS `*.devops.aliyuncs.com` organization host verified against official documentation. The portable doctor reads that value from `YUNXIAO_API_BASE_URL`.

Do not use `ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID` as project context. Read organization and project IDs from the repository-root `yunxiao.toml`; a global organization variable must not override a project binding.

## Preflight state machine

Run these checks in order and stop on the first blocking result:

1. Detect `win32`, `darwin`, or `linux`, Node.js availability, shell, architecture, and proxy environment.
2. Detect whether the active client supports remote Streamable HTTP MCP and Bearer-token environment references. Inspect verified client capabilities; do not infer configuration from a product name.
3. Check whether the Yunxiao tools required by the requested action are already visible. Code actions additionally require `code-management` tools.
4. Check the primary token variable and legacy alias for presence and equality. Never print, hash, summarize, or log either value.
5. Validate the official HTTPS endpoint, DNS, TLS, proxy path, and response protocol. Never disable certificate validation or follow an untrusted redirect.
6. Perform a minimal read-only identity call.
7. List tools and verify capabilities required by the requested action, including repository and merge-request tools for code actions.
8. When `yunxiao.toml` exists, call `get_project` with its organization/project IDs and compare the returned project ID, name, and code snapshots. Local syntax alone never authorizes writes.
9. Require a new client process when configuration or environment changed, then repeat the read-only checks.

Use these statuses:

| Status | Meaning | Write policy |
|---|---|---|
| `READY` | MCP, auth, capabilities, and binding are valid | Requested single writes may proceed |
| `BINDING_MISSING` | MCP is usable but the local project is not bound | Discovery reads only |
| `BINDING_INVALID` | `yunxiao.toml` is malformed, unsupported, remotely unresolved, or stale | No writes |
| `TOKEN_MISSING` / `TOKEN_INVALID` | Credential is absent or malformed | No calls requiring auth |
| `AUTH_FAILED` | Token is rejected or expired | No writes; replace token locally |
| `PERMISSION_DENIED` | Identity lacks the required organization/project scope | No writes |
| `MCP_MISSING` / `CAPABILITY_MISSING` | Server or required tools are unavailable | No writes |
| `ENDPOINT_INVALID` | Endpoint or Region host violates the official allowlist | No network call |
| `RATE_LIMITED` | Service returned HTTP 429 | No automatic retry; honor server timing |
| `NETWORK_ERROR` | DNS, TLS, proxy, timeout, or 5xx failure | No automatic write retry |
| `UNSUPPORTED_PLATFORM` / `UNSUPPORTED_CLIENT` | Portable setup cannot safely configure this environment | Give manual verified guidance |
| `RESTART_REQUIRED` | Config changed but a new process has not verified it | No writes |
| `CONFIG_ERROR` | Protocol or configuration is malformed | No writes |

## Portable doctor

From the Skill root:

```bash
node scripts/doctor.mjs --project-root <project-root>
node scripts/doctor.mjs --project-root <project-root> --json
```

The script requires Node.js 18+, is read-only, and never modifies an agent config, shell profile, proxy, certificate store, repository, or GUI process. It directly verifies the official MCP service, required core tools, token presence, `yunxiao.toml` syntax, and—when a binding exists—the remote project identity and display snapshots. Package, application-delivery, test, and high-risk write tools are checked per request against the active MCP tool list and input contract; they are not all made global readiness requirements. Its JSON `binding.status` is `LOCAL_VALID` until remote verification succeeds and `VERIFIED` afterward; only `VERIFIED` can produce `writeReady: true`. A direct service success does not prove that an already-running GUI client inherited the same environment; validate again from a new client process.

## Configure the MCP in your client

Confirm the client supports remote Streamable HTTP MCP, then show the user the exact entry before changing anything. The URL, toolsets, and `Authorization: Bearer <token>` header come from [Official service contract](#official-service-contract). Reference the token as an environment variable so the secret is never written into a config file.

### Claude Code

Project-scoped file `<project-root>/.mcp.json` (same on every OS; `${VAR}` is expanded by Claude Code at start-up, so no secret is stored):

```json
{
  "mcpServers": {
    "yunxiao": {
      "type": "http",
      "url": "https://openapi-rdc.aliyuncs.com/ai/mcp?toolsets=organization-management,project-management,code-management,pipeline-management,packages-management,application-delivery,test-management",
      "headers": { "Authorization": "Bearer ${ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN}" }
    }
  }
}
```

Or per user via the CLI. Single quotes keep the `${...}` reference literal in PowerShell, zsh, and bash (not in `cmd.exe`; use PowerShell there):

```text
claude mcp add --transport http --scope user yunxiao 'https://openapi-rdc.aliyuncs.com/ai/mcp?toolsets=organization-management,project-management,code-management,pipeline-management,packages-management,application-delivery,test-management' --header 'Authorization: Bearer ${ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN}'
```

Verify with `claude mcp list` from a new process. If the entry already exists with a literal token in the header (a common cause of `AUTH_FAILED` after expiry), tell the user to `claude mcp remove yunxiao` and re-add it with the env reference, or edit the header value locally; never print the existing header.

### Other clients

Use the client's documented MCP interface (see the generic workflow below) with the same URL and header. The environment variable must be visible to the client process: on macOS/Linux launch GUI clients from a terminal where it is exported, because GUI launchers usually do not read shell profiles; on Windows set it for the user account (see persistence below) and restart the client.

## Client-neutral configuration workflow

If MCP is missing:

1. Determine the current client's documented MCP installation command or configuration interface.
2. Show the exact target, hosted URL, toolset restriction, and environment-variable reference before changing anything.
3. Prefer the client's supported CLI or structured API over editing private files.
4. Back up a config before an explicitly authorized manual edit.
5. Never guess a schema or path and never overwrite unrelated MCP entries.
6. Ask the user to create a Yunxiao personal access token with the scopes in [Token scopes](#token-scopes). Do not ask them to paste it into chat.
7. Configure the token locally through an `ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN` environment reference or supported secret store. If legacy clients still need `YUNXIAO_ACCESS_TOKEN`, export it from the same secret rather than maintaining a second value.
8. Start a new client process and verify identity plus required tools.

The Agent Skills specification does not define discovery directories or MCP configuration. The Skill cannot install itself before it is loaded. Obtain the canonical package from `https://github.com/huhengbo/skills/tree/main/skills/yunxiao-project-lifecycle`, then use a client-supported installer or the bundled explicit-target installer.

## Safe local token entry

Prefer a client or operating-system secret store. For a session-only environment inherited by child CLI processes:

### Windows PowerShell

```powershell
$secureToken = Read-Host "Yunxiao token" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $env:ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
```

### macOS zsh

```zsh
read -s "ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN?Yunxiao token: "
export ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN
echo
```

### Linux bash

```bash
read -r -s -p "Yunxiao token: " ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN
export ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN
printf '\n'
```

These values exist only in that process and its children. Do not automatically write shell startup files or use command forms that place the token in shell history. GUI environment inheritance differs by launcher and operating system; use the client's secure mechanism or launch a new process from the configured environment.

## Persisting the token (explicit user opt-in only)

The snippets above last for one process. Persisting is the user's choice; never run these for them, never print the value, and prefer a keychain over plaintext.

| Platform | Keychain (preferred) | Plaintext fallback |
|---|---|---|
| macOS | Store once: `security add-generic-password -a "$USER" -s yunxiao-token -w` (prompts for the value). In `~/.zshrc`: `export ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN="$(security find-generic-password -a "$USER" -s yunxiao-token -w)"` | `export` line in `~/.zshrc` with the file readable only by the user (`chmod 600`) |
| Linux | Store once: `secret-tool store --label=yunxiao service yunxiao-token` (needs `libsecret-tools` and a running keyring). In `~/.bashrc`: `export ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN="$(secret-tool lookup service yunxiao-token)"` | `export` line in `~/.bashrc` / `~/.profile`, `chmod 600` |
| Windows | Use Windows Credential Manager or the client's secret store | Run the SecureString snippet above, then `[Environment]::SetEnvironmentVariable("ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN", $env:ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN, "User")`; this stores it unencrypted in the user's registry hive |

After persisting, start a new terminal and client process, then run the doctor.

## Repair boundaries

Safe assistance may inspect documented client help, add a named remote MCP entry through a verified interface, preserve a config backup, and explain restart requirements. Do not automatically obtain/rotate PATs, change system proxy or TLS trust, persist plaintext secrets, kill client processes, restart the OS, accept arbitrary endpoints, or report `READY` without a new read-only verification.
