import test from "node:test";
import assert from "node:assert/strict";

import {
  LEGACY_PROTOCOL_VERSION,
  MODERN_PROTOCOL_VERSION,
  listAllTools,
  negotiateMcpSession,
  parseEventStreamMessages,
} from "../scripts/lib/doctor-core.mjs";

function response(body, { status = 200, headers = {} } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": "application/json", ...headers } });
}

function rpc(id, result) {
  return { jsonrpc: "2.0", id, result };
}

test("modern negotiation uses discover and never initialize", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ request, headers: new Headers(options.headers) });
    if (request.method === "server/discover") {
      return response(rpc(request.id, { supportedVersions: [MODERN_PROTOCOL_VERSION] }));
    }
    return response(rpc(request.id, { tools: [] }));
  };

  const session = await negotiateMcpSession({ fetchImpl, token: "secret", timeoutMs: 1000 });
  assert.equal(session.era, "modern");
  await session.request("tools/list", {});

  assert.deepEqual(calls.map(({ request }) => request.method), ["server/discover", "tools/list"]);
  assert.equal(calls.some(({ request }) => request.method === "initialize"), false);
  assert.equal(calls[0].headers.get("MCP-Protocol-Version"), MODERN_PROTOCOL_VERSION);
  assert.equal(calls[0].headers.get("Mcp-Method"), "server/discover");
  assert.equal(calls[1].headers.get("Mcp-Method"), "tools/list");
  assert.equal(calls[1].request.params._meta["io.modelcontextprotocol/protocolVersion"], MODERN_PROTOCOL_VERSION);
});

test("legacy fallback performs initialize and preserves session id", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    const headers = new Headers(options.headers);
    calls.push({ request, headers });
    if (request.method === "server/discover") {
      return response({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "not found" } });
    }
    if (request.method === "initialize") {
      return response(rpc(request.id, { protocolVersion: LEGACY_PROTOCOL_VERSION, capabilities: {}, serverInfo: { name: "legacy", version: "1" } }), {
        headers: { "mcp-session-id": "session-123" },
      });
    }
    if (request.method === "notifications/initialized") {
      return response("", { status: 202, headers: { "content-type": "text/plain" } });
    }
    return response(rpc(request.id, { tools: [] }));
  };

  const session = await negotiateMcpSession({ fetchImpl, token: "secret", timeoutMs: 1000 });
  assert.equal(session.era, "legacy");
  assert.equal(session.version, LEGACY_PROTOCOL_VERSION);
  await session.request("tools/list", {});

  assert.deepEqual(calls.map(({ request }) => request.method), [
    "server/discover", "initialize", "notifications/initialized", "tools/list",
  ]);
  assert.equal(calls.at(-1).headers.get("Mcp-Session-Id"), "session-123");
  assert.equal(calls.at(-1).headers.get("MCP-Protocol-Version"), LEGACY_PROTOCOL_VERSION);
});

test("tools/list follows cursors until complete", async () => {
  const requests = [];
  const session = {
    async request(method, params) {
      requests.push({ method, params });
      if (requests.length === 1) return rpc(1, { tools: [{ name: "a" }], nextCursor: "page-2" });
      return rpc(2, { tools: [{ name: "b" }] });
    },
  };
  const result = await listAllTools(session);
  assert.equal(result.pages, 2);
  assert.deepEqual(result.tools.map((tool) => tool.name), ["a", "b"]);
  assert.deepEqual(requests[1].params, { cursor: "page-2" });
});

test("tools/list rejects repeated cursors", async () => {
  const session = {
    async request() {
      return rpc(1, { tools: [], nextCursor: "same" });
    },
  };
  await assert.rejects(() => listAllTools(session), /PAGINATION_ERROR/);
});

test("SSE joins multiple data lines in one event", () => {
  const messages = parseEventStreamMessages('event: message\ndata: {"jsonrpc":"2.0",\ndata: "id":7,"result":{"ok":true}}\n\n');
  assert.deepEqual(messages, [{ jsonrpc: "2.0", id: 7, result: { ok: true } }]);
});
