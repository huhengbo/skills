const SETUP_DOC = "references/mcp-setup.md";
const BINDING_DOC = "references/project-binding.md";

const TOKEN_SOURCE_NOTE = "The doctor only reads the environment variable; a token stored directly in the client's MCP config (for example an Authorization header) is invisible to it.";

const STEPS = Object.freeze({
  TOKEN_MISSING: [
    `Create a Yunxiao personal access token and export it locally as ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN (${SETUP_DOC}, "Get the token" and "Safe local token entry"). Do not paste it into chat.`,
    TOKEN_SOURCE_NOTE,
    "Start a new client/terminal process, then rerun the doctor.",
  ],
  TOKEN_INVALID: [
    "The token contains control characters or surrounding whitespace. Re-enter it with the platform snippet in \"Safe local token entry\".",
  ],
  AUTH_FAILED: [
    `The token was rejected or has expired. Create a new token (${SETUP_DOC}, "Get the token") and replace it everywhere it is stored: the environment variable and any client MCP config.`,
    "Start a new client process, then rerun the doctor.",
  ],
  PERMISSION_DENIED: [
    `The token lacks scope for this request. Recreate it with the scopes for the needed toolsets (${SETUP_DOC}, "Token scopes").`,
  ],
  MCP_MISSING: [
    `Add the Yunxiao MCP to the client (${SETUP_DOC}, "Configure the MCP in your client"), then start a new client process.`,
  ],
  CAPABILITY_MISSING: [
    `The MCP is reachable but required tools are absent. Check that the MCP URL keeps every needed toolset and that the token has the matching scopes (${SETUP_DOC}, "Token scopes").`,
  ],
  CONTRACT_MISSING: [
    "Required tools exist but their input contract differs. Update the MCP server/client and rerun; do not write until this clears.",
  ],
  BINDING_MISSING: [
    `The MCP works but this project is not bound. Ask the agent to create yunxiao.toml (${BINDING_DOC}, "Create a binding"); pick the project from discovered candidates.`,
  ],
  BINDING_INVALID: [
    `yunxiao.toml is malformed, stale, or does not match the remote project. Fix or recreate it (${BINDING_DOC}).`,
  ],
  ENDPOINT_INVALID: [
    "YUNXIAO_API_BASE_URL must be an HTTPS *.devops.aliyuncs.com host. Unset it unless you use a dedicated Region installation.",
  ],
  RATE_LIMITED: ["Wait for the server-indicated time before rerunning; nothing is retried automatically."],
  NETWORK_ERROR: [
    "DNS, TLS, proxy, timeout, or 5xx failure. Check connectivity to openapi-rdc.aliyuncs.com and proxy variables (HTTPS_PROXY), then rerun.",
  ],
  UNSUPPORTED_PLATFORM: [`Unsupported platform. Follow ${SETUP_DOC} for manual guidance.`],
  CONFIG_ERROR: [
    "Conflicting or malformed configuration. If ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN and YUNXIAO_ACCESS_TOKEN differ, keep only the primary one.",
  ],
});

export function nextStepsFor(status) {
  return [...(STEPS[status] ?? [])];
}
