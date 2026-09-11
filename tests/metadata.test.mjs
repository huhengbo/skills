import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
}

test("manifest, marketplace, and per-skill plugin metadata agree", async () => {
  const manifest = await readJson("skills-manifest.json");
  const marketplace = await readJson(".claude-plugin/marketplace.json");
  assert.equal(manifest.schema_version, 1);

  const expected = new Map(
    manifest.skills
      .filter((skill) => skill.claude_marketplace)
      .map((skill) => [skill.name, skill]),
  );
  const actual = new Map(marketplace.plugins.map((plugin) => [plugin.name, plugin]));
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort());

  for (const [name, skill] of expected) {
    const marketplaceEntry = actual.get(name);
    assert.equal(marketplaceEntry.version, skill.version, `${name} marketplace version`);
    assert.equal(marketplaceEntry.source, `./skills/${name}`, `${name} marketplace source`);

    const plugin = await readJson(`skills/${name}/.claude-plugin/plugin.json`);
    assert.equal(plugin.name, name, `${name} plugin name`);
    assert.equal(plugin.version, skill.version, `${name} plugin version`);
  }
});
