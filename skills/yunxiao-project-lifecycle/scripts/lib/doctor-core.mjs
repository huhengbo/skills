import { parseBinding } from "./binding.mjs";

export const DEFAULT_MCP_URL = "https://openapi-rdc.aliyuncs.com/ai/mcp?toolsets=organization-management,project-management,code-management,pipeline-management";
export const PRIMARY_TOKEN_ENV = "ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN";
export const LEGACY_TOKEN_ENV = "YUNXIAO_ACCESS_TOKEN";

export const REQUIRED_TOOLS = Object.freeze([
  "get_current_user",
  "get_current_organization_info",
  "get_user_organizations",
  "get_project",
  "search_projects",
  "search_organization_members",
  "get_organization_member_info_by_user_id",
  "get_work_item",
  "create_work_item",
  "search_workitems",
  "list_work_item_types",
  "get_work_item_type",
  "get_work_item_workflow",
  "update_work_item",
  "list_work_item_comments",
  "create_work_item_comment",
  "list_workitem_activities",
  "list_versions",
  "create_version",
  "update_version",
  "list_sprints",
  "get_sprint",
  "create_sprint",
  "update_sprint",
  "get_repository",
  "list_repositories",
  "get_branch",
  "list_branches",
  "create_branch",
  "list_files",
  "get_file_blobs",
  "create_file",
  "update_file",
  "list_commits",
  "get_commit",
  "get_compare",
  "get_change_request",
  "list_change_requests",
  "create_change_request",
  "create_change_request_comment",
  "review_change_request",
  "merge_change_request",
  "list_pipelines",
  "get_pipeline",
  "get_latest_pipeline_run",
  "list_pipeline_runs",
  "get_pipeline_run",
  "list_pipeline_jobs_by_category",
  "list_pipeline_job_historys",
  "get_pipeline_job_run_log",
]);

export const TOOL_ALIASES = Object.freeze({
  get_compare: Object.freeze(["compare"]),
});

const SUPPORTED_PLATFORMS = new Set(["win32", "darwin", "linux"]);
const REGION_HOST = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.devops\.aliyuncs\.com$/i;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

class DoctorFailure extends Error {
  constructor(status) {
    super(status);
    this.status = status;
  }
}

function createResult({
  status,
  platform,
  bindingStatus,
  tokenPresent = false,
  tokenSource = null,
  missing = [],
  regionConfigured = false,
}) {
  return {
    status,
    readOnlyReady: status === "READY" || status === "BINDING_MISSING",
    writeReady: status === "READY",
    platform,
    architecture: process.arch,
    endpoint: {
      url: DEFAULT_MCP_URL,
      regionConfigured,
    },
    token: {
      present: tokenPresent,
      source: tokenSource,
    },
    binding: {
      status: bindingStatus,
    },
    capabilities: {
      required: REQUIRED_TOOLS.length,
      missing,
    },
  };
}

function inspectTokenEnvironment(env) {
  const primary = env[PRIMARY_TOKEN_ENV];
  const legacy = env[LEGACY_TOKEN_ENV];

  if (primary && legacy && primary !== legacy) {
    return { conflict: true, present: true, source: null, value: null };
  }
  if (primary) {
    return { conflict: false, present: true, source: PRIMARY_TOKEN_ENV, value: primary };
  }
  if (legacy) {
    return { conflict: false, present: true, source: LEGACY_TOKEN_ENV, value: legacy };
  }
  return { conflict: false, present: false, source: null, value: null };
}

function validateRegionBaseUrl(rawValue) {
  if (!rawValue) {
    return null;
  }

  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new DoctorFailure("ENDPOINT_INVALID");
  }

  const isRoot = url.pathname === "/" || url.pathname === "";
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || url.search
    || url.hash
    || !isRoot
    || !REGION_HOST.test(url.hostname)
  ) {
    throw new DoctorFailure("ENDPOINT_INVALID");
  }

  return url.origin;
}

function parseEventStream(text) {
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]");
  if (dataLines.length === 0) {
    throw new DoctorFailure("CONFIG_ERROR");
  }

  try {
    return JSON.parse(dataLines.at(-1));
  } catch {
    throw new DoctorFailure("CONFIG_ERROR");
  }
}

async function parseMcpResponse(response) {
  switch (response.status) {
    case 401:
      throw new DoctorFailure("AUTH_FAILED");
    case 403:
      throw new DoctorFailure("PERMISSION_DENIED");
    case 404:
    case 405:
      throw new DoctorFailure("MCP_MISSING");
    case 429:
      throw new DoctorFailure("RATE_LIMITED");
    default:
      if (response.status >= 500) {
        throw new DoctorFailure("NETWORK_ERROR");
      }
      if (!response.ok) {
        throw new DoctorFailure("CONFIG_ERROR");
      }
  }

  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream") || /^\s*(?:event:|data:)/m.test(text)) {
    return parseEventStream(text);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new DoctorFailure("CONFIG_ERROR");
  }
}

async function callMcp({ fetchImpl, token, regionBaseUrl, payload, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (regionBaseUrl) {
    headers["X-Yunxiao-Api-Base-Url"] = regionBaseUrl;
  }

  try {
    const response = await fetchImpl(DEFAULT_MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      redirect: "error",
      signal: controller.signal,
    });
    return await parseMcpResponse(response);
  } catch (error) {
    if (error instanceof DoctorFailure) {
      throw error;
    }
    throw new DoctorFailure("NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

function inspectBinding(bindingText) {
  if (bindingText === null || bindingText === undefined) {
    return { status: "BINDING_MISSING", value: null };
  }
  try {
    return { status: "LOCAL_VALID", value: parseBinding(bindingText) };
  } catch {
    return { status: "BINDING_INVALID", value: null };
  }
}

function parseToolObject(response, toolErrorStatus) {
  if (response.error || response.result?.isError === true) {
    throw new DoctorFailure(toolErrorStatus);
  }

  const structured = response.result?.structuredContent;
  if (structured && typeof structured === "object" && !Array.isArray(structured)) {
    return structured;
  }

  const content = response.result?.content;
  if (content !== undefined && !Array.isArray(content)) {
    throw new DoctorFailure("CONFIG_ERROR");
  }

  for (const item of content ?? []) {
    if (item?.type !== "text" || typeof item.text !== "string") {
      continue;
    }
    try {
      const value = JSON.parse(item.text);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
      }
    } catch {
      // Continue looking for a structured JSON text result.
    }
  }

  throw new DoctorFailure("CONFIG_ERROR");
}

function verifyIdentity(response) {
  const identity = parseToolObject(response, "AUTH_FAILED");
  if (typeof identity.id !== "string" || identity.id.trim().length === 0) {
    throw new DoctorFailure("AUTH_FAILED");
  }
}

function verifyProjectBinding(binding, response) {
  const project = parseToolObject(response, "BINDING_INVALID");
  if (typeof project.id !== "string") {
    throw new DoctorFailure("CONFIG_ERROR");
  }
  if (project.id !== binding.project.id) {
    throw new DoctorFailure("BINDING_INVALID");
  }
  if (binding.project.name !== undefined && project.name !== binding.project.name) {
    throw new DoctorFailure("BINDING_INVALID");
  }
  if (binding.project.custom_code !== undefined && project.customCode !== binding.project.custom_code) {
    throw new DoctorFailure("BINDING_INVALID");
  }
}

function findMissingTools(available) {
  return REQUIRED_TOOLS.filter((name) => {
    if (available.has(name)) {
      return false;
    }
    return !(TOOL_ALIASES[name] ?? []).some((alias) => available.has(alias));
  });
}

export async function runDoctor({
  env = process.env,
  platform = process.platform,
  fetchImpl = globalThis.fetch,
  bindingText = null,
  timeoutMs = 15_000,
} = {}) {
  const binding = inspectBinding(bindingText);
  const tokenEnvironment = inspectTokenEnvironment(env);

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return createResult({
      status: "UNSUPPORTED_PLATFORM",
      platform,
      bindingStatus: binding.status,
      tokenPresent: tokenEnvironment.present,
      tokenSource: tokenEnvironment.source,
    });
  }

  let regionBaseUrl;
  try {
    regionBaseUrl = validateRegionBaseUrl(env.YUNXIAO_API_BASE_URL);
  } catch (error) {
    return createResult({
      status: error.status,
      platform,
      bindingStatus: binding.status,
      tokenPresent: tokenEnvironment.present,
      tokenSource: tokenEnvironment.source,
    });
  }

  if (tokenEnvironment.conflict) {
    return createResult({
      status: "CONFIG_ERROR",
      platform,
      bindingStatus: binding.status,
      tokenPresent: true,
      tokenSource: null,
      regionConfigured: Boolean(regionBaseUrl),
    });
  }

  const token = tokenEnvironment.value;
  if (!token) {
    return createResult({
      status: "TOKEN_MISSING",
      platform,
      bindingStatus: binding.status,
      tokenPresent: false,
      tokenSource: null,
      regionConfigured: Boolean(regionBaseUrl),
    });
  }
  if (CONTROL_CHARACTER.test(token) || token.trim() !== token) {
    return createResult({
      status: "TOKEN_INVALID",
      platform,
      bindingStatus: binding.status,
      tokenPresent: true,
      tokenSource: tokenEnvironment.source,
      regionConfigured: Boolean(regionBaseUrl),
    });
  }

  if (binding.status === "BINDING_INVALID") {
    return createResult({
      status: binding.status,
      platform,
      bindingStatus: binding.status,
      tokenPresent: true,
      tokenSource: tokenEnvironment.source,
      regionConfigured: Boolean(regionBaseUrl),
    });
  }

  try {
    const toolsResponse = await callMcp({
      fetchImpl,
      token,
      regionBaseUrl,
      timeoutMs,
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    });
    if (toolsResponse.error || !Array.isArray(toolsResponse.result?.tools)) {
      throw new DoctorFailure("CONFIG_ERROR");
    }

    const available = new Set(toolsResponse.result.tools.map((tool) => tool.name));
    const missing = findMissingTools(available);
    if (missing.length > 0) {
      return createResult({
        status: "CAPABILITY_MISSING",
        platform,
        bindingStatus: binding.status,
        tokenPresent: true,
        tokenSource: tokenEnvironment.source,
        missing,
        regionConfigured: Boolean(regionBaseUrl),
      });
    }

    const identityResponse = await callMcp({
      fetchImpl,
      token,
      regionBaseUrl,
      timeoutMs,
      payload: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_current_user", arguments: {} },
      },
    });
    verifyIdentity(identityResponse);

    if (binding.status === "BINDING_MISSING") {
      return createResult({
        status: "BINDING_MISSING",
        platform,
        bindingStatus: binding.status,
        tokenPresent: true,
        tokenSource: tokenEnvironment.source,
        regionConfigured: Boolean(regionBaseUrl),
      });
    }

    const projectResponse = await callMcp({
      fetchImpl,
      token,
      regionBaseUrl,
      timeoutMs,
      payload: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_project",
          arguments: {
            organizationId: binding.value.organization.id,
            id: binding.value.project.id,
          },
        },
      },
    });
    verifyProjectBinding(binding.value, projectResponse);

    return createResult({
      status: "READY",
      platform,
      bindingStatus: "VERIFIED",
      tokenPresent: true,
      tokenSource: tokenEnvironment.source,
      regionConfigured: Boolean(regionBaseUrl),
    });
  } catch (error) {
    const status = error instanceof DoctorFailure ? error.status : "NETWORK_ERROR";
    return createResult({
      status,
      platform,
      bindingStatus: status === "BINDING_INVALID" ? "BINDING_INVALID" : binding.status,
      tokenPresent: true,
      tokenSource: tokenEnvironment.source,
      regionConfigured: Boolean(regionBaseUrl),
    });
  }
}
