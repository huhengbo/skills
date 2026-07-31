# MCP setup and diagnostics

## Official service contract

Prefer the Alibaba Cloud hosted Yunxiao MCP service:

```text
URL: https://openapi-rdc.aliyuncs.com/ai/mcp?toolsets=organization-management,project-management
Transport: Streamable HTTP (stateless)
Authentication: Authorization: Bearer <ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN>
```

Use `ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN` as the primary environment-variable name. Accept `YUNXIAO_ACCESS_TOKEN` only as a legacy alias to the same secret. If both exist with different values, report `CONFIG_ERROR` without making a network request. Never pass a token in the query string. For a dedicated Region installation, keep the hosted MCP URL and add `X-Yunxiao-Api-Base-Url` only for an HTTPS `*.devops.aliyuncs.com` organization host verified against official documentation. The portable doctor reads that value from `YUNXIAO_API_BASE_URL`.

Do not use `ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID` as project context. Read organization and project IDs from the repository-root `yunxiao.toml`; a global organization variable must not override a project binding.

## Preflight state machine

Run these checks in order and stop on the first blocking result:

1. Detect `win32`, `darwin`, or `linux`, Node.js availability, shell, architecture, and proxy environment.
2. Detect whether the active client supports remote Streamable HTTP MCP and Bearer-token environment references. Inspect verified client capabilities; do not infer configuration from a product name.
3. Check whether the required Yunxiao organization/project tools are already visible.
4. Check the primary token variable and legacy alias for presence and equality. Never print, hash, summarize, or log either value.
5. Validate the official HTTPS endpoint, DNS, TLS, proxy path, and response protocol. Never disable certificate validation or follow an untrusted redirect.
6. Perform a minimal read-only identity call.
7. List tools and verify capabilities required by the requested action.
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

The script requires Node.js 18+, is read-only, and never modifies an agent config, shell profile, proxy, certificate store, repository, or GUI process. It directly verifies the official MCP service, required tools, token presence, `yunxiao.toml` syntax, and—when a binding exists—the remote project identity and display snapshots. Its JSON `binding.status` is `LOCAL_VALID` until remote verification succeeds and `VERIFIED` afterward; only `VERIFIED` can produce `writeReady: true`. A direct service success does not prove that an already-running GUI client inherited the same environment; validate again from a new client process.

## Client-neutral configuration workflow

If MCP is missing:

1. Determine the current client's documented MCP installation command or configuration interface.
2. Show the exact target, hosted URL, toolset restriction, and environment-variable reference before changing anything.
3. Prefer the client's supported CLI or structured API over editing private files.
4. Back up a config before an explicitly authorized manual edit.
5. Never guess a schema or path and never overwrite unrelated MCP entries.
6. Ask the user to create a Yunxiao personal access token with minimum Organization read and Projex read/write scopes. Do not ask them to paste it into chat.
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

## Repair boundaries

Safe assistance may inspect documented client help, add a named remote MCP entry through a verified interface, preserve a config backup, and explain restart requirements. Do not automatically obtain/rotate PATs, change system proxy or TLS trust, persist plaintext secrets, kill client processes, restart the OS, accept arbitrary endpoints, or report `READY` without a new read-only verification.
