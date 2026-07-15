import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseBinding, readBinding } from "../scripts/lib/binding.mjs";

const MINIMAL = `
schema_version = 1

[organization]
id = "org-1"
name = "Example Org"

[project]
id = "project-1"
name = "Example Project"
custom_code = "DEMO"
`;

test("parses required and optional binding sections", () => {
  const binding = parseBinding(`${MINIMAL}
[workitem_types.requirement]
id = "req-type-1"
name = "Requirement"

[workitem_types.bug]
id = "bug-type-1"
name = "Bug"

[assignees.requirement]
user_id = "user-product"
name = "Product Owner"

[assignees.bug]
user_id = "user-engineer"
name = "Bug Owner"
`);

  assert.equal(binding.schema_version, 1);
  assert.equal(binding.organization.id, "org-1");
  assert.equal(binding.project.id, "project-1");
  assert.equal(binding.workitem_types.bug.id, "bug-type-1");
  assert.equal(binding.assignees.requirement.user_id, "user-product");
});

test("supports comments outside and after quoted values", () => {
  const binding = parseBinding(`# project binding
schema_version = 1 # supported schema
[organization]
id = "org-1" # stable id
[project]
id = "project-1"
name = "Hash # stays in value"
`);

  assert.equal(binding.project.name, "Hash # stays in value");
});

test("rejects unsupported schema versions", () => {
  assert.throws(
    () => parseBinding(MINIMAL.replace("schema_version = 1", "schema_version = 2")),
    /unsupported schema_version 2/i,
  );
});

test("rejects missing required fields", () => {
  assert.throws(
    () => parseBinding(MINIMAL.replace('id = "project-1"', "")),
    /project\.id is required/i,
  );
});

test("rejects duplicate keys", () => {
  assert.throws(
    () => parseBinding(MINIMAL.replace('id = "org-1"', 'id = "org-1"\nid = "org-2"')),
    /duplicate key organization\.id/i,
  );
});

test("rejects unknown sections and keys", () => {
  assert.throws(() => parseBinding(`${MINIMAL}\n[secrets]\ntoken = "no"\n`), /unsupported section/i);
  assert.throws(() => parseBinding(MINIMAL.replace('name = "Example Org"', 'region = "cn"')), /unsupported key organization\.region/i);
});

test("rejects placeholder, blank, control-character, and unquoted identifiers", () => {
  assert.throws(() => parseBinding(MINIMAL.replace("org-1", "<organization-id>")), /placeholder/i);
  assert.throws(() => parseBinding(MINIMAL.replace("org-1", " <organization-id> ")), /placeholder/i);
  assert.throws(() => parseBinding(MINIMAL.replace('id = "org-1"', 'id = ""')), /must not be empty/i);
  assert.throws(() => parseBinding(MINIMAL.replace('id = "org-1"', 'id = "   "')), /must not be empty/i);
  assert.throws(() => parseBinding(MINIMAL.replace('id = "org-1"', 'id = "org\\n1"')), /control character/i);
  assert.throws(() => parseBinding(MINIMAL.replace('id = "org-1"', "id = org-1")), /quoted string/i);
});

test("requires paired optional identifiers and display names", () => {
  assert.throws(
    () => parseBinding(`${MINIMAL}\n[workitem_types.bug]\nid = "bug-type-1"\n`),
    /workitem_types\.bug\.name is required/i,
  );
  assert.throws(
    () => parseBinding(`${MINIMAL}\n[assignees.bug]\nname = "Bug Owner"\n`),
    /assignees\.bug\.user_id is required/i,
  );
});

test("reads a binding file from disk", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yunxiao-binding-"));
  const file = path.join(directory, "yunxiao.toml");
  await writeFile(file, MINIMAL, { mode: 0o600 });

  const binding = await readBinding(file);
  assert.equal(binding.project.id, "project-1");
});
