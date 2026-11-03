// Narrow Yunxiao Projex OpenAPI client for work-item operations the official MCP does not expose:
// relation records, whole-description replacement, and hierarchy reads. Everything else goes through MCP.

export const DEFAULT_OPENAPI_BASE = "https://openapi-rdc.aliyuncs.com";
export const PRIMARY_TOKEN_ENV = "ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN";
export const LEGACY_TOKEN_ENV = "YUNXIAO_ACCESS_TOKEN";
export const RELATION_TYPES = Object.freeze(["PARENT", "SUB", "ASSOCIATED", "DEPEND_ON", "DEPENDED_BY"]);
export const WRITABLE_RELATION_TYPES = Object.freeze(["SUB", "ASSOCIATED", "DEPEND_ON"]);
export const SEARCH_CATEGORIES = Object.freeze(["Req", "Bug", "Task"]);

const REGION_HOST = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.devops\.aliyuncs\.com$/i;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const SERIAL = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
const MAX_TREE_NODES = 500;

export class OpenApiError extends Error {
  constructor(status, message, httpStatus = null) {
    super(message);
    this.status = status;
    this.httpStatus = httpStatus;
  }
}

export function resolveToken(env) {
  const primary = env[PRIMARY_TOKEN_ENV];
  const legacy = env[LEGACY_TOKEN_ENV];
  if (primary && legacy && primary !== legacy) throw new OpenApiError("CONFIG_ERROR", `${PRIMARY_TOKEN_ENV} and ${LEGACY_TOKEN_ENV} differ`);
  const token = primary || legacy;
  if (!token) throw new OpenApiError("TOKEN_MISSING", `${PRIMARY_TOKEN_ENV} is not set`);
  if (CONTROL_CHARACTER.test(token) || token.trim() !== token) throw new OpenApiError("TOKEN_INVALID", "token contains whitespace or control characters");
  return token;
}

export function resolveBaseUrl(env) {
  const raw = env.YUNXIAO_API_BASE_URL;
  if (!raw) return DEFAULT_OPENAPI_BASE;
  let url;
  try { url = new URL(raw); } catch { throw new OpenApiError("ENDPOINT_INVALID", "YUNXIAO_API_BASE_URL is not a URL"); }
  const isRoot = url.pathname === "/" || url.pathname === "";
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || !isRoot || !REGION_HOST.test(url.hostname)) {
    throw new OpenApiError("ENDPOINT_INVALID", "YUNXIAO_API_BASE_URL must be an https *.devops.aliyuncs.com origin");
  }
  return url.origin;
}

export function createClient({ binding, env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  const token = resolveToken(env);
  const base = `${resolveBaseUrl(env)}/oapi/v1/projex/organizations/${encodeURIComponent(binding.organization.id)}`;
  const projectId = binding.project.id;
  const projectCode = binding.project.custom_code ?? null;

  async function call(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(base + path, {
        method,
        headers: { "x-yunxiao-token": token, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      throw new OpenApiError("UNCERTAIN", `${method} ${path} transport error: ${error.name}`);
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    if (!response.ok) {
      // Error bodies are short service messages; never echo request headers.
      throw new OpenApiError("HTTP_ERROR", `${method} ${path} -> ${response.status} ${text.slice(0, 300)}`, response.status);
    }
    return text ? JSON.parse(text) : null;
  }

  async function getById(id) {
    return call("GET", `/workitems/${encodeURIComponent(id)}`);
  }

  async function resolve(key) {
    if (!SERIAL.test(key)) return getById(key);
    const serial = key.toUpperCase();
    if (projectCode && !serial.startsWith(`${projectCode.toUpperCase()}-`)) {
      throw new OpenApiError("REJECTED", `${key} does not belong to bound project code ${projectCode}`);
    }
    const conditions = JSON.stringify({
      conditionGroups: [[{ fieldIdentifier: "serialNumber", operator: "CONTAINS", value: [serial], toValue: null, className: "string", format: "input" }]],
    });
    const matches = [];
    // Search is category-scoped; CONTAINS also matches longer serials, so compare exactly.
    for (const category of SEARCH_CATEGORIES) {
      const hits = await call("POST", "/workitems:search", { category, spaceId: projectId, conditions, perPage: 20 });
      for (const item of hits ?? []) if (String(item.serialNumber).toUpperCase() === serial) matches.push(item);
    }
    if (matches.length !== 1) throw new OpenApiError("REJECTED", `${key} matched ${matches.length} work items in the bound project`);
    return getById(matches[0].id);
  }

  async function relations(id, relationType) {
    if (!RELATION_TYPES.includes(relationType)) throw new OpenApiError("REJECTED", `unknown relation type ${relationType}`);
    return (await call("GET", `/workitems/${encodeURIComponent(id)}/relationRecords?relationType=${relationType}`)) ?? [];
  }

  async function tree(rootKey) {
    const root = await resolve(rootKey);
    const seen = new Set();
    async function walk(item, depth) {
      if (seen.has(item.id)) return [];
      seen.add(item.id);
      if (seen.size > MAX_TREE_NODES) throw new OpenApiError("REJECTED", `tree exceeds ${MAX_TREE_NODES} nodes`);
      const rows = [{ depth, item }];
      for (const record of await relations(item.id, "SUB")) rows.push(...await walk(await getById(record.resourceId), depth + 1));
      return rows;
    }
    return walk(root, 0);
  }

  async function relate(sourceKey, targetKey, relationType, { apply = false } = {}) {
    if (!WRITABLE_RELATION_TYPES.includes(relationType)) throw new OpenApiError("REJECTED", `relation type ${relationType} is not writable here; create the inverse instead`);
    const source = await resolve(sourceKey);
    const target = await resolve(targetKey);
    if (source.id === target.id) throw new OpenApiError("REJECTED", "a work item cannot relate to itself");
    const exists = async () => (await relations(source.id, relationType)).some((record) => record.resourceId === target.id);
    const plan = { action: "relate", source: source.serialNumber, target: target.serialNumber, relationType };
    if (await exists()) return { ...plan, status: "VERIFIED_SUCCESS", note: "already present; no write submitted" };
    if (!apply) return { ...plan, status: "DRY_RUN" };
    try {
      await call("POST", `/workitems/${encodeURIComponent(source.id)}/relationRecords`, { relationType, workitemId: target.id });
    } catch (error) {
      if (error.status === "HTTP_ERROR") return { ...plan, status: "FAILED", error: error.message };
      return { ...plan, status: "SUBMITTED_UNVERIFIED", error: error.message };
    }
    return { ...plan, status: (await exists()) ? "VERIFIED_SUCCESS" : "SUBMITTED_UNVERIFIED" };
  }

  async function setDescription(key, description, { apply = false, expectedCurrent = null } = {}) {
    if (typeof description !== "string" || description.trim() === "") throw new OpenApiError("REJECTED", "description must be non-empty");
    const item = await resolve(key);
    const current = item.description ?? "";
    const plan = { action: "set-description", target: item.serialNumber, currentLength: current.length, newLength: description.length };
    if (expectedCurrent !== null && current !== expectedCurrent) return { ...plan, status: "REJECTED", error: "description changed since it was read; re-read before replacing" };
    if (current.trim() === description.trim()) return { ...plan, status: "VERIFIED_SUCCESS", note: "already identical; no write submitted" };
    if (!apply) return { ...plan, status: "DRY_RUN" };
    try {
      await call("PUT", `/workitems/${encodeURIComponent(item.id)}`, { description, formatType: "MARKDOWN" });
    } catch (error) {
      if (error.status === "HTTP_ERROR") return { ...plan, status: "FAILED", error: error.message };
      return { ...plan, status: "SUBMITTED_UNVERIFIED", error: error.message };
    }
    const after = (await getById(item.id)).description ?? "";
    return { ...plan, status: after.trim() === description.trim() ? "VERIFIED_SUCCESS" : "SUBMITTED_UNVERIFIED" };
  }

  return { resolve, relations, tree, relate, setDescription, getById };
}

export function summarize(item) {
  return `${item.serialNumber} [${item.status?.displayName ?? "?"}] ${item.subject}`;
}
