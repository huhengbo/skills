import test from "node:test";
import assert from "node:assert/strict";

import {
  CAPABILITY_PROFILES,
  PRIMARY_TOKEN_ENV,
  inspectCapabilityContracts,
  runDoctor,
} from "../scripts/lib/doctor-core.mjs";

const BINDING = `
schema_version = 1
[organization]
id = "org-1"
[project]
id = "project-1"
name = "Project"
`;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function successfulFetch(tools) {
  return async (_url, options) => {
    const request = JSON.parse(options.body);
    if (request.method === "tools/list") {
      return jsonResponse({ jsonrpc: "2.0", id: request.id, result: { tools } });
    }
    if (request.params.name === "get_project") {
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: { content: [{ type: "text", text: '{"id":"project-1","name":"Project"}' }] },
      });
    }
    return jsonResponse({
      jsonrpc: "2.0",
      id: request.id,
      result: { content: [{ type: "text", text: '{"id":"user-1"}' }] },
    });
  };
}

function profileTools(name, { omit = [] } = {}) {
  return CAPABILITY_PROFILES[name].tools
    .filter((toolName) => !omit.includes(toolName))
    .map((toolName) => ({ name: toolName, inputSchema: { type: "object" } }));
}

test("pipeline-read is not blocked by unrelated work-item write capabilities", async () => {
  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    bindingText: BINDING,
    capability: "pipeline-read",
    fetchImpl: successfulFetch(profileTools("pipeline-read")),
  });

  assert.equal(result.status, "READY");
  assert.equal(result.readOnlyReady, true);
  assert.equal(result.capabilities.profile, "pipeline-read");
  assert.equal(result.capabilities.missing.includes("create_work_item"), false);
  assert.equal(result.writeReady, false);
  assert.equal(result.writePreflightReady, false);
  assert.equal(result.readiness.targetAuthorization, false);
});

test("reports the exact missing request-scoped capability", async () => {
  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "win32",
    bindingText: BINDING,
    capability: "pipeline-read",
    fetchImpl: successfulFetch(profileTools("pipeline-read", { omit: ["get_pipeline_run"] })),
  });

  assert.equal(result.status, "CAPABILITY_MISSING");
  assert.deepEqual(result.capabilities.missing, ["get_pipeline_run"]);
  assert.equal(result.readOnlyReady, false);
});

test("write profiles require input contracts for their write tools", async () => {
  const tools = profileTools("code-write");
  const target = tools.find((tool) => tool.name === "create_change_request");
  delete target.inputSchema;

  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "darwin",
    bindingText: BINDING,
    capability: "code-write",
    fetchImpl: successfulFetch(tools),
  });

  assert.equal(result.status, "CONTRACT_MISSING");
  assert.deepEqual(result.capabilities.contractMissing, ["create_change_request"]);
  assert.equal(result.writePreflightReady, false);
});

test("successful write preflight never claims target/workflow authorization", async () => {
  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    bindingText: BINDING,
    capability: "code-write",
    fetchImpl: successfulFetch(profileTools("code-write")),
  });

  assert.equal(result.status, "READY");
  assert.equal(result.writePreflightReady, true);
  assert.equal(result.writeReady, false);
  assert.equal(result.readiness.targetAuthorization, false);
});

test("verified aliases satisfy read capability profiles", () => {
  const tools = CAPABILITY_PROFILES["code-read"].tools.map((name) => ({
    name: name === "get_compare" ? "compare" : name,
  }));

  const gaps = inspectCapabilityContracts(tools, "code-read");
  assert.deepEqual(gaps.missing, []);
  assert.deepEqual(gaps.contractMissing, []);
});
