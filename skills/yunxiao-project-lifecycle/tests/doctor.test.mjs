import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_MCP_URL,
  LEGACY_TOKEN_ENV,
  PRIMARY_TOKEN_ENV,
  REQUIRED_TOOLS,
  runDoctor,
} from "../scripts/lib/doctor-core.mjs";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCTOR_CLI = path.join(SKILL_ROOT, "scripts", "doctor.mjs");

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

function successfulFetch({
  missingTools = [],
  aliases = [],
  sse = false,
  project = { id: "project-1", name: "Project" },
  projectError = false,
  calls = [],
} = {}) {
  return async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);

    const respond = (payload) => {
      if (sse) {
        return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return jsonResponse(payload);
    };

    if (request.method === "tools/list") {
      const tools = REQUIRED_TOOLS
        .filter((name) => !missingTools.includes(name))
        .map((name) => ({ name }));
      tools.push(...aliases.map((name) => ({ name })));
      const payload = { jsonrpc: "2.0", id: request.id, result: { tools } };
      return respond(payload);
    }
    if (request.params.name === "get_project") {
      if (projectError) {
        return respond({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32000, message: "project unavailable" },
        });
      }
      return respond({
        jsonrpc: "2.0",
        id: request.id,
        result: { content: [{ type: "text", text: JSON.stringify(project) }] },
      });
    }
    return respond({
      jsonrpc: "2.0",
      id: request.id,
      result: { content: [{ type: "text", text: "{\"id\":\"user-1\"}" }] },
    });
  };
}

test("reports TOKEN_MISSING without making a request", async () => {
  let called = false;
  const result = await runDoctor({
    env: {},
    platform: "linux",
    fetchImpl: async () => { called = true; throw new Error("unexpected"); },
    bindingText: null,
  });

  assert.equal(result.status, "TOKEN_MISSING");
  assert.equal(result.token.source, null);
  assert.equal(result.writeReady, false);
  assert.equal(called, false);
  assert.doesNotMatch(JSON.stringify(result), /Bearer\s+/i);
});

test("rejects malformed tokens without making a request", async () => {
  for (const token of [" leading-space", "trailing-space ", "line\nbreak"]) {
    let called = false;
    const result = await runDoctor({
      env: { [PRIMARY_TOKEN_ENV]: token },
      platform: "linux",
      fetchImpl: async () => { called = true; throw new Error("unexpected"); },
      bindingText: BINDING,
    });
    assert.equal(result.status, "TOKEN_INVALID");
    assert.equal(result.token.present, true);
    assert.equal(result.token.source, PRIMARY_TOKEN_ENV);
    assert.equal(called, false);
    assert.equal(JSON.stringify(result).includes(token), false);
  }
});

test("prefers the primary token environment and accepts the legacy alias", async () => {
  for (const [env, expectedSource] of [
    [{ [PRIMARY_TOKEN_ENV]: "secret" }, PRIMARY_TOKEN_ENV],
    [{ [LEGACY_TOKEN_ENV]: "secret" }, LEGACY_TOKEN_ENV],
    [{ [PRIMARY_TOKEN_ENV]: "secret", [LEGACY_TOKEN_ENV]: "secret" }, PRIMARY_TOKEN_ENV],
  ]) {
    const result = await runDoctor({
      env,
      platform: "linux",
      fetchImpl: successfulFetch(),
      bindingText: null,
    });

    assert.equal(result.status, "BINDING_MISSING");
    assert.equal(result.token.source, expectedSource);
  }
});

test("rejects conflicting token aliases without making a request", async () => {
  let called = false;
  const result = await runDoctor({
    env: {
      [PRIMARY_TOKEN_ENV]: "primary-secret",
      [LEGACY_TOKEN_ENV]: "different-legacy-secret",
    },
    platform: "linux",
    fetchImpl: async () => { called = true; throw new Error("unexpected"); },
    bindingText: BINDING,
  });

  assert.equal(result.status, "CONFIG_ERROR");
  assert.equal(result.token.present, true);
  assert.equal(result.token.source, null);
  assert.equal(result.writeReady, false);
  assert.equal(called, false);
  assert.doesNotMatch(JSON.stringify(result), /primary-secret|different-legacy-secret/);
});

test("does not treat a global organization variable as project binding", async () => {
  let called = false;
  const result = await runDoctor({
    env: { ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID: "global-org" },
    platform: "linux",
    fetchImpl: async () => { called = true; throw new Error("unexpected"); },
    bindingText: null,
  });

  assert.equal(result.status, "TOKEN_MISSING");
  assert.equal(result.binding.status, "BINDING_MISSING");
  assert.equal(called, false);
});

test("rejects unsupported platforms without making a request", async () => {
  let called = false;
  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "freebsd",
    fetchImpl: async () => { called = true; throw new Error("unexpected"); },
    bindingText: BINDING,
  });

  assert.equal(result.status, "UNSUPPORTED_PLATFORM");
  assert.equal(result.token.present, true);
  assert.equal(result.token.source, PRIMARY_TOKEN_ENV);
  assert.equal(called, false);
});

test("does not claim a token exists when an earlier platform check fails", async () => {
  const result = await runDoctor({ env: {}, platform: "freebsd", bindingText: null });
  assert.equal(result.status, "UNSUPPORTED_PLATFORM");
  assert.equal(result.token.present, false);
});

test("maps authentication and permission failures", async () => {
  for (const [httpStatus, expected] of [[401, "AUTH_FAILED"], [403, "PERMISSION_DENIED"]]) {
    const result = await runDoctor({
      env: { [PRIMARY_TOKEN_ENV]: "secret" },
      platform: "win32",
      fetchImpl: async () => jsonResponse({}, httpStatus),
      bindingText: BINDING,
    });
    assert.equal(result.status, expected);
  }
});

test("maps endpoint, rate limit, server, and transport failures", async () => {
  const cases = [
    [async () => jsonResponse({}, 404), "MCP_MISSING"],
    [async () => jsonResponse({}, 429), "RATE_LIMITED"],
    [async () => jsonResponse({}, 503), "NETWORK_ERROR"],
    [async () => { throw new Error("socket closed"); }, "NETWORK_ERROR"],
  ];

  for (const [fetchImpl, expected] of cases) {
    const result = await runDoctor({
      env: { [PRIMARY_TOKEN_ENV]: "secret" },
      platform: "darwin",
      fetchImpl,
      bindingText: BINDING,
    });
    assert.equal(result.status, expected);
  }
});

test("rejects invalid Region base URLs before making a request", async () => {
  let called = false;
  const result = await runDoctor({
    env: {
      [PRIMARY_TOKEN_ENV]: "secret",
      YUNXIAO_API_BASE_URL: "http://evil.example.com",
    },
    platform: "linux",
    fetchImpl: async () => { called = true; throw new Error("unexpected"); },
    bindingText: BINDING,
  });

  assert.equal(result.status, "ENDPOINT_INVALID");
  assert.equal(called, false);
});

test("reports invalid and missing bindings separately", async () => {
  const invalid = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    fetchImpl: successfulFetch(),
    bindingText: "schema_version = 2",
  });
  assert.equal(invalid.status, "BINDING_INVALID");

  const missing = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    fetchImpl: successfulFetch(),
    bindingText: null,
  });
  assert.equal(missing.status, "BINDING_MISSING");
  assert.equal(missing.readOnlyReady, true);
  assert.equal(missing.writeReady, false);
  assert.equal(missing.binding.status, "BINDING_MISSING");
});

test("reports missing required MCP capabilities", async () => {
  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    fetchImpl: successfulFetch({ missingTools: ["create_work_item"] }),
    bindingText: BINDING,
  });

  assert.equal(result.status, "CAPABILITY_MISSING");
  assert.deepEqual(result.capabilities.missing, ["create_work_item"]);
});

test("reports missing Codeup merge-request capability", async () => {
  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    fetchImpl: successfulFetch({ missingTools: ["create_change_request"] }),
    bindingText: BINDING,
  });

  assert.equal(result.status, "CAPABILITY_MISSING");
  assert.deepEqual(result.capabilities.missing, ["create_change_request"]);
  assert.equal(result.writeReady, false);
});

test("reports missing pipeline-management capability", async () => {
  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    fetchImpl: successfulFetch({ missingTools: ["list_pipeline_runs"] }),
    bindingText: BINDING,
  });

  assert.equal(result.status, "CAPABILITY_MISSING");
  assert.deepEqual(result.capabilities.missing, ["list_pipeline_runs"]);
  assert.equal(result.writeReady, false);
});

test("accepts a verified comparison-tool alias", async () => {
  const result = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    fetchImpl: successfulFetch({ missingTools: ["get_compare"], aliases: ["compare"] }),
    bindingText: BINDING,
  });

  assert.equal(result.status, "READY");
  assert.deepEqual(result.capabilities.missing, []);
});

test("reaches READY for JSON and SSE MCP responses", async () => {
  for (const sse of [false, true]) {
    const calls = [];
    const result = await runDoctor({
      env: {
        [PRIMARY_TOKEN_ENV]: "secret-value-that-must-never-leak",
        YUNXIAO_API_BASE_URL: "https://example.devops.aliyuncs.com",
      },
      platform: "darwin",
      fetchImpl: successfulFetch({ sse, calls }),
      bindingText: BINDING,
    });

    assert.equal(result.status, "READY");
    assert.equal(result.writeReady, true);
    assert.equal(result.binding.status, "VERIFIED");
    assert.equal(result.architecture, process.arch);
    assert.equal(result.endpoint.url, DEFAULT_MCP_URL);
    assert.match(DEFAULT_MCP_URL, /code-management/);
    assert.match(DEFAULT_MCP_URL, /pipeline-management/);
    assert.match(DEFAULT_MCP_URL, /packages-management/);
    assert.match(DEFAULT_MCP_URL, /application-delivery/);
    assert.match(DEFAULT_MCP_URL, /test-management/);
    assert.equal(result.endpoint.regionConfigured, true);
    assert.equal(JSON.stringify(result).includes("secret-value"), false);
    assert.equal(JSON.stringify(result).includes("example.devops.aliyuncs.com"), false);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[2].params, {
      name: "get_project",
      arguments: { organizationId: "org-1", id: "project-1" },
    });
  }
});

test("rejects a remote project mismatch or stale display snapshot", async () => {
  for (const project of [
    { id: "different-project", name: "Project" },
    { id: "project-1", name: "Renamed Project" },
  ]) {
    const result = await runDoctor({
      env: { [PRIMARY_TOKEN_ENV]: "secret" },
      platform: "linux",
      fetchImpl: successfulFetch({ project }),
      bindingText: BINDING,
    });

    assert.equal(result.status, "BINDING_INVALID");
    assert.equal(result.binding.status, "BINDING_INVALID");
    assert.equal(result.writeReady, false);
  }
});

test("verifies a configured project code and rejects remote lookup errors", async () => {
  const bindingWithCode = `${BINDING}custom_code = "DEMO"\n`;
  const staleCode = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    fetchImpl: successfulFetch({ project: { id: "project-1", name: "Project", customCode: "OTHER" } }),
    bindingText: bindingWithCode,
  });
  assert.equal(staleCode.status, "BINDING_INVALID");

  const lookupError = await runDoctor({
    env: { [PRIMARY_TOKEN_ENV]: "secret" },
    platform: "linux",
    fetchImpl: successfulFetch({ projectError: true }),
    bindingText: BINDING,
  });
  assert.equal(lookupError.status, "BINDING_INVALID");
  assert.equal(lookupError.writeReady, false);
});

test("CLI help is client-neutral", () => {
  const result = spawnSync(process.execPath, [DOCTOR_CLI, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Yunxiao MCP/);
});

test("CLI emits redacted JSON for a missing token", async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), "yunxiao-doctor-"));
  const env = { ...process.env };
  delete env[PRIMARY_TOKEN_ENV];
  delete env[LEGACY_TOKEN_ENV];
  delete env.YUNXIAO_API_BASE_URL;
  const result = spawnSync(process.execPath, [DOCTOR_CLI, "--json", "--project-root", projectRoot], {
    encoding: "utf8",
    env,
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(output.status, "TOKEN_MISSING");
  assert.equal(output.token.present, false);
  assert.doesNotMatch(result.stdout, /Bearer\s+/i);
});
