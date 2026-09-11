import { parseBinding } from "./binding.mjs";

export const DEFAULT_MCP_URL = "https://openapi-rdc.aliyuncs.com/ai/mcp?toolsets=organization-management,project-management,code-management,pipeline-management,packages-management,application-delivery,test-management";
export const PRIMARY_TOKEN_ENV = "ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN";
export const LEGACY_TOKEN_ENV = "YUNXIAO_ACCESS_TOKEN";

const CORE_TOOLS = Object.freeze(["get_current_user", "get_project"]);
const PROJECT_READ_TOOLS = Object.freeze(["search_projects"]);
const WORKITEM_READ_TOOLS = Object.freeze([
  "get_work_item", "search_workitems", "list_work_item_types", "get_work_item_type",
  "get_work_item_workflow", "list_work_item_comments", "list_workitem_activities",
  "list_versions", "list_sprints", "get_sprint",
]);
const WORKITEM_WRITE_TOOLS = Object.freeze([
  "create_work_item", "update_work_item", "create_work_item_comment",
  "create_version", "update_version", "create_sprint", "update_sprint",
]);
const CODE_READ_TOOLS = Object.freeze([
  "get_repository", "list_repositories", "get_branch", "list_branches", "list_files",
  "get_file_blobs", "list_commits", "get_commit", "get_compare", "get_change_request",
  "list_change_requests",
]);
const CODE_WRITE_TOOLS = Object.freeze([
  "create_branch", "create_file", "update_file", "create_change_request",
  "create_change_request_comment", "review_change_request", "merge_change_request",
]);
const PIPELINE_READ_TOOLS = Object.freeze([
  "list_pipelines", "get_pipeline", "get_latest_pipeline_run", "list_pipeline_runs",
  "get_pipeline_run", "list_pipeline_jobs_by_category", "list_pipeline_job_historys",
  "get_pipeline_job_run_log",
]);
const PIPELINE_CONTROL_TOOLS = Object.freeze([
  "create_pipeline_run", "stop_pipeline_job_run", "execute_pipeline_job_run",
  "retry_pipeline_job_run", "rerun_pipeline_job_run", "skip_pipeline_job_run",
  "execute_pipeline_job_action",
]);
const PACKAGE_READ_TOOLS = Object.freeze(["list_package_repositories", "list_artifacts", "get_artifact"]);
const APPLICATION_DELIVERY_TOOLS = Object.freeze([
  "list_applications", "get_application", "create_change_order",
  "execute_app_release_stage", "cancel_app_release_stage_execution",
  "retry_app_release_stage_pipeline", "skip_app_release_stage_pipeline",
]);
const TEST_MANAGEMENT_TOOLS = Object.freeze([
  "list_testcase_directories", "search_testcases", "get_testcase", "list_test_plans",
  "get_test_result_list", "get_test_plan_progress", "list_test_plan_result_directories",
]);
const TEST_WRITE_TOOLS = Object.freeze(["create_testcase_directory", "create_testcase", "delete_testcase", "update_test_result"]);

function profile(readTools, writeTools = []) {
  return Object.freeze({
    tools: Object.freeze([...new Set([...CORE_TOOLS, ...readTools, ...writeTools])]),
    writeTools: Object.freeze([...writeTools]),
  });
}

export const CAPABILITY_PROFILES = Object.freeze({
  "project-read": profile(PROJECT_READ_TOOLS),
  "workitem-read": profile(WORKITEM_READ_TOOLS),
  "workitem-write": profile(WORKITEM_READ_TOOLS, WORKITEM_WRITE_TOOLS),
  "code-read": profile(CODE_READ_TOOLS),
  "code-write": profile(CODE_READ_TOOLS, CODE_WRITE_TOOLS),
  "pipeline-read": profile(PIPELINE_READ_TOOLS),
  "pipeline-control": profile(PIPELINE_READ_TOOLS, PIPELINE_CONTROL_TOOLS),
  "package-read": profile(PACKAGE_READ_TOOLS),
  "application-delivery": profile([], APPLICATION_DELIVERY_TOOLS),
  "test-read": profile(TEST_MANAGEMENT_TOOLS),
  "test-management": profile(TEST_MANAGEMENT_TOOLS, TEST_WRITE_TOOLS),
});

// Backward-compatible full catalog for older callers/tests. New callers should select a request-scoped profile.
export const REQUIRED_TOOLS = Object.freeze([
  "get_current_user", "get_current_organization_info", "get_user_organizations", "get_project",
  "search_projects", "search_organization_members", "get_organization_member_info_by_user_id",
  "get_work_item", "create_work_item", "search_workitems", "list_work_item_types",
  "get_work_item_type", "get_work_item_workflow", "update_work_item", "list_work_item_comments",
  "create_work_item_comment", "list_workitem_activities", "list_versions", "create_version",
  "update_version", "list_sprints", "get_sprint", "create_sprint", "update_sprint",
  "get_repository", "list_repositories", "get_branch", "list_branches", "create_branch",
  "list_files", "get_file_blobs", "create_file", "update_file", "list_commits", "get_commit",
  "get_compare", "get_change_request", "list_change_requests", "create_change_request",
  "create_change_request_comment", "review_change_request", "merge_change_request",
  "list_pipelines", "get_pipeline", "get_latest_pipeline_run", "list_pipeline_runs",
  "get_pipeline_run", "list_pipeline_jobs_by_category", "list_pipeline_job_historys",
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

function resolveCapabilityProfile(capability) {
  if (capability === "full") {
    return { name: "full", tools: REQUIRED_TOOLS, writeTools: [] };
  }
  const selected = CAPABILITY_PROFILES[capability];
  if (!selected) {
    throw new DoctorFailure("CAPABILITY_PROFILE_INVALID");
  }
  return { name: capability, ...selected };
}

function createResult({
  status,
  platform,
  bindingStatus,
  tokenPresent = false,
  tokenSource = null,
  missing = [],
  contractMissing = [],
  regionConfigured = false,
  capabilityProfile = "full",
  serviceReady = false,
  identityReady = false,
  capabilityReady = false,
}) {
  const bindingReady = bindingStatus === "VERIFIED";
  const selected = capabilityProfile === "full" ? { writeTools: [] } : CAPABILITY_PROFILES[capabilityProfile];
  const writePreflightRequested = (selected?.writeTools?.length ?? 0) > 0;
  return {
    status,
    // Compatibility field: means read preflight for the selected scope, not global MCP readiness.
    readOnlyReady: serviceReady && identityReady && capabilityReady && (bindingReady || bindingStatus === "BINDING_MISSING"),
    // Deprecated compatibility field for the legacy full-catalog preflight only.
    // Request-scoped profiles must use writePreflightReady and still perform target/workflow checks.
    writeReady: capabilityProfile === "full" && status === "READY" && bindingReady,
    writePreflightReady: writePreflightRequested && serviceReady && identityReady && capabilityReady && bindingReady,
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
    readiness: {
      service: serviceReady,
      identity: identityReady,
      binding: bindingReady,
      capability: capabilityReady,
      targetAuthorization: false,
    },
    capabilities: {
      profile: capabilityProfile,
      required: capabilityProfile === "full" ? REQUIRED_TOOLS.length : CAPABILITY_PROFILES[capabilityProfile]?.tools.length ?? 0,
      missing,
      contractMissing,
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

function resolveTool(toolMap, expectedName) {
  if (toolMap.has(expectedName)) {
    return toolMap.get(expectedName);
  }
  for (const alias of TOOL_ALIASES[expectedName] ?? []) {
    if (toolMap.has(alias)) {
      return toolMap.get(alias);
    }
  }
  return null;
}

export function inspectCapabilityContracts(tools, capability = "full") {
  const selected = resolveCapabilityProfile(capability);
  const toolMap = new Map(
    tools
      .filter((tool) => tool && typeof tool.name === "string")
      .map((tool) => [tool.name, tool]),
  );
  const missing = [];
  const contractMissing = [];
  for (const name of selected.tools) {
    const tool = resolveTool(toolMap, name);
    if (!tool) {
      missing.push(name);
      continue;
    }
    if (selected.writeTools.includes(name)) {
      const schema = tool.inputSchema;
      if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        contractMissing.push(name);
      }
    }
  }
  return { missing, contractMissing };
}

export async function runDoctor({
  env = process.env,
  platform = process.platform,
  fetchImpl = globalThis.fetch,
  bindingText = null,
  timeoutMs = 15_000,
  capability = "full",
} = {}) {
  const binding = inspectBinding(bindingText);
  const tokenEnvironment = inspectTokenEnvironment(env);
  let selected;
  try {
    selected = resolveCapabilityProfile(capability);
  } catch (error) {
    return createResult({
      status: error.status,
      platform,
      bindingStatus: binding.status,
      tokenPresent: tokenEnvironment.present,
      tokenSource: tokenEnvironment.source,
      capabilityProfile: "full",
    });
  }

  const common = {
    platform,
    bindingStatus: binding.status,
    tokenPresent: tokenEnvironment.present,
    tokenSource: tokenEnvironment.source,
    capabilityProfile: selected.name,
  };

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return createResult({ ...common, status: "UNSUPPORTED_PLATFORM" });
  }

  let regionBaseUrl;
  try {
    regionBaseUrl = validateRegionBaseUrl(env.YUNXIAO_API_BASE_URL);
  } catch (error) {
    return createResult({ ...common, status: error.status });
  }
  const withRegion = { ...common, regionConfigured: Boolean(regionBaseUrl) };

  if (tokenEnvironment.conflict) {
    return createResult({ ...withRegion, status: "CONFIG_ERROR", tokenPresent: true, tokenSource: null });
  }

  const token = tokenEnvironment.value;
  if (!token) {
    return createResult({ ...withRegion, status: "TOKEN_MISSING", tokenPresent: false, tokenSource: null });
  }
  if (CONTROL_CHARACTER.test(token) || token.trim() !== token) {
    return createResult({ ...withRegion, status: "TOKEN_INVALID", tokenPresent: true });
  }
  if (binding.status === "BINDING_INVALID") {
    return createResult({ ...withRegion, status: "BINDING_INVALID" });
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

    const gaps = inspectCapabilityContracts(toolsResponse.result.tools, selected.name);
    if (gaps.missing.length > 0) {
      return createResult({
        ...withRegion,
        status: "CAPABILITY_MISSING",
        missing: gaps.missing,
        contractMissing: gaps.contractMissing,
        serviceReady: true,
      });
    }
    if (gaps.contractMissing.length > 0) {
      return createResult({
        ...withRegion,
        status: "CONTRACT_MISSING",
        contractMissing: gaps.contractMissing,
        serviceReady: true,
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
        ...withRegion,
        status: "BINDING_MISSING",
        serviceReady: true,
        identityReady: true,
        capabilityReady: true,
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
      ...withRegion,
      status: "READY",
      bindingStatus: "VERIFIED",
      serviceReady: true,
      identityReady: true,
      capabilityReady: true,
    });
  } catch (error) {
    const status = error instanceof DoctorFailure ? error.status : "NETWORK_ERROR";
    return createResult({
      ...withRegion,
      status,
      bindingStatus: status === "BINDING_INVALID" ? "BINDING_INVALID" : binding.status,
    });
  }
}
