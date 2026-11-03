import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_OPENAPI_BASE, OpenApiError, createClient, resolveBaseUrl, resolveToken } from "../scripts/lib/openapi.mjs";

const BINDING = { organization: { id: "org-1" }, project: { id: "project-1", custom_code: "DEMO" } };
const ENV = { ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN: "token-value" };

function item(id, serial, extra = {}) {
  return { id, serialNumber: serial, subject: `subject ${serial}`, status: { displayName: "Todo" }, description: "old", ...extra };
}

// Minimal in-memory Projex: items by id, relations by `${id}:${type}`.
function fakeProjex({ items, relations = {}, failPost = null, dropWrites = false }) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace("/oapi/v1/projex/organizations/org-1", "");
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method: options.method, path, body, headers: options.headers, redirect: options.redirect });
    const json = (value, status = 200) => new Response(value === null ? null : JSON.stringify(value), { status });

    if (options.method === "POST" && path === "/workitems:search") {
      const serial = JSON.parse(body.conditions).conditionGroups[0][0].value[0];
      return json(Object.values(items).filter((entry) => entry.category === body.category && entry.serialNumber.includes(serial)));
    }
    const relationMatch = path.match(/^\/workitems\/([^/]+)\/relationRecords$/);
    if (relationMatch) {
      const key = `${relationMatch[1]}:${options.method === "GET" ? searchParams.get("relationType") : body.relationType}`;
      if (options.method === "GET") return json((relations[key] ?? []).map((resourceId) => ({ resourceId })));
      if (failPost) return json({ errorMessage: failPost }, 400);
      if (!dropWrites) (relations[key] ??= []).push(body.workitemId);
      return json({ id: "rel-1" });
    }
    const itemMatch = path.match(/^\/workitems\/([^/]+)$/);
    if (itemMatch && options.method === "GET") return items[itemMatch[1]] ? json(items[itemMatch[1]]) : json({}, 404);
    if (itemMatch && options.method === "PUT") {
      if (!dropWrites) items[itemMatch[1]].description = body.description;
      return json(null, 204);
    }
    return json({}, 500);
  };
  return { fetchImpl, calls };
}

test("token resolution rejects conflicting aliases and missing tokens", () => {
  assert.equal(resolveToken(ENV), "token-value");
  assert.equal(resolveToken({ YUNXIAO_ACCESS_TOKEN: "legacy" }), "legacy");
  assert.throws(() => resolveToken({ ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN: "a", YUNXIAO_ACCESS_TOKEN: "b" }), { status: "CONFIG_ERROR" });
  assert.throws(() => resolveToken({}), { status: "TOKEN_MISSING" });
  assert.throws(() => resolveToken({ ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN: " padded" }), { status: "TOKEN_INVALID" });
});

test("base URL accepts only the official host or an https region origin", () => {
  assert.equal(resolveBaseUrl({}), DEFAULT_OPENAPI_BASE);
  assert.equal(resolveBaseUrl({ YUNXIAO_API_BASE_URL: "https://acme.devops.aliyuncs.com" }), "https://acme.devops.aliyuncs.com");
  for (const bad of ["http://acme.devops.aliyuncs.com", "https://evil.example.com", "https://acme.devops.aliyuncs.com/path"]) {
    assert.throws(() => resolveBaseUrl({ YUNXIAO_API_BASE_URL: bad }), { status: "ENDPOINT_INVALID" });
  }
});

test("serial lookup searches every category and requires an exact match", async () => {
  const items = {
    a: { ...item("a", "DEMO-1"), category: "Req" },
    b: { ...item("b", "DEMO-12"), category: "Req" },
    c: { ...item("c", "DEMO-2"), category: "Bug" },
  };
  const { fetchImpl, calls } = fakeProjex({ items });
  const client = createClient({ binding: BINDING, env: ENV, fetchImpl });
  assert.equal((await client.resolve("DEMO-1")).id, "a");
  assert.equal((await client.resolve("DEMO-2")).id, "c");
  assert.deepEqual(calls.filter((call) => call.path === "/workitems:search").map((call) => call.body.category).slice(0, 3), ["Req", "Bug", "Task"]);
  assert.ok(calls.every((call) => call.headers["x-yunxiao-token"] === "token-value" && call.redirect === "error"));
  await assert.rejects(client.resolve("DEMO-99"), { status: "REJECTED" });
  await assert.rejects(client.resolve("OTHER-1"), { status: "REJECTED" });
});

test("relate is dry-run by default, skips duplicates, and verifies after writing", async () => {
  const items = { a: { ...item("a", "DEMO-1"), category: "Req" }, b: { ...item("b", "DEMO-2"), category: "Req" } };
  const projex = fakeProjex({ items });
  const client = createClient({ binding: BINDING, env: ENV, fetchImpl: projex.fetchImpl });

  assert.equal((await client.relate("DEMO-1", "DEMO-2", "ASSOCIATED")).status, "DRY_RUN");
  assert.equal(projex.calls.filter((call) => call.method === "POST" && call.path.endsWith("relationRecords")).length, 0);

  assert.equal((await client.relate("DEMO-1", "DEMO-2", "ASSOCIATED", { apply: true })).status, "VERIFIED_SUCCESS");
  const again = await client.relate("DEMO-1", "DEMO-2", "ASSOCIATED", { apply: true });
  assert.equal(again.status, "VERIFIED_SUCCESS");
  assert.match(again.note, /already present/);
  assert.equal(projex.calls.filter((call) => call.method === "POST" && call.path.endsWith("relationRecords")).length, 1);

  await assert.rejects(client.relate("DEMO-1", "DEMO-1", "ASSOCIATED"), { status: "REJECTED" });
  await assert.rejects(client.relate("DEMO-1", "DEMO-2", "PARENT"), { status: "REJECTED" });
});

test("relate reports service rejection as FAILED and unverifiable writes as SUBMITTED_UNVERIFIED", async () => {
  const items = { a: { ...item("a", "DEMO-1"), category: "Req" }, b: { ...item("b", "DEMO-2"), category: "Req" } };
  const rejected = createClient({ binding: BINDING, env: ENV, fetchImpl: fakeProjex({ items, failPost: "type constraint" }).fetchImpl });
  const failed = await rejected.relate("DEMO-1", "DEMO-2", "DEPEND_ON", { apply: true });
  assert.equal(failed.status, "FAILED");
  assert.match(failed.error, /400/);

  const dropped = createClient({ binding: BINDING, env: ENV, fetchImpl: fakeProjex({ items, dropWrites: true }).fetchImpl });
  assert.equal((await dropped.relate("DEMO-1", "DEMO-2", "ASSOCIATED", { apply: true })).status, "SUBMITTED_UNVERIFIED");
});

test("set-description replaces markdown, guards concurrent edits, and verifies", async () => {
  const items = { a: { ...item("a", "DEMO-1"), category: "Req" } };
  const projex = fakeProjex({ items });
  const client = createClient({ binding: BINDING, env: ENV, fetchImpl: projex.fetchImpl });

  assert.equal((await client.setDescription("DEMO-1", "## new")).status, "DRY_RUN");
  assert.equal((await client.setDescription("DEMO-1", "## new", { apply: true, expectedCurrent: "stale" })).status, "REJECTED");
  assert.equal((await client.setDescription("DEMO-1", "## new", { apply: true })).status, "VERIFIED_SUCCESS");
  const put = projex.calls.find((call) => call.method === "PUT");
  assert.deepEqual(put.body, { description: "## new", formatType: "MARKDOWN" });
  assert.match((await client.setDescription("DEMO-1", "## new", { apply: true })).note, /identical/);
  await assert.rejects(client.setDescription("DEMO-1", "  "), OpenApiError);

  const dropped = createClient({ binding: BINDING, env: ENV, fetchImpl: fakeProjex({ items: { a: { ...item("a", "DEMO-1"), category: "Req" } }, dropWrites: true }).fetchImpl });
  assert.equal((await dropped.setDescription("DEMO-1", "## lost", { apply: true })).status, "SUBMITTED_UNVERIFIED");
});

test("tree follows SUB relations depth-first without revisiting nodes", async () => {
  const items = {
    root: { ...item("root", "DEMO-1"), category: "Req" },
    child: item("child", "DEMO-2"),
    grandchild: item("grandchild", "DEMO-3"),
  };
  const relations = { "root:SUB": ["child"], "child:SUB": ["grandchild", "root"] };
  const client = createClient({ binding: BINDING, env: ENV, fetchImpl: fakeProjex({ items, relations }).fetchImpl });
  const rows = await client.tree("DEMO-1");
  assert.deepEqual(rows.map(({ depth, item: entry }) => [depth, entry.serialNumber]), [[0, "DEMO-1"], [1, "DEMO-2"], [2, "DEMO-3"]]);
});
