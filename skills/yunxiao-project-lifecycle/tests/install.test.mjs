import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readdir, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INSTALL_CLI = path.join(SKILL_ROOT, "scripts", "install.mjs");

function runInstaller(args, env = {}) {
  return spawnSync(process.execPath, [INSTALL_CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("requires an explicit installation target", () => {
  const env = { ...process.env };
  delete env.AGENT_SKILLS_DIR;
  const result = spawnSync(process.execPath, [INSTALL_CLI, "--json"], { encoding: "utf8", env });
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).status, "SKILL_INSTALL_TARGET_REQUIRED");
});

test("dry-run reports the destination without creating it", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-dry-"));
  const result = runInstaller(["--json", "--target", target]);
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.status, "DRY_RUN");
  assert.equal(output.destination, path.join(target, "yunxiao-project-lifecycle"));
  await assert.rejects(access(output.destination));
});

test("apply installs the complete portable skill", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-apply-"));
  const result = runInstaller(["--json", "--target", target, "--apply"]);
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.status, "INSTALLED");
  const skill = await readFile(path.join(output.destination, "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: yunxiao-project-lifecycle/m);
  await access(path.join(output.destination, "scripts", "doctor.mjs"));
});

test("a second apply preserves a backup", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-backup-"));
  const first = runInstaller(["--json", "--target", target, "--apply"]);
  assert.equal(first.status, 0);
  const second = runInstaller(["--json", "--target", target, "--apply"]);
  const output = JSON.parse(second.stdout);

  assert.equal(second.status, 0);
  assert.equal(output.status, "INSTALLED");
  assert.ok(output.backup);
  const entries = await readdir(target);
  assert.ok(entries.some((entry) => entry.startsWith("yunxiao-project-lifecycle.backup-")));
});

test("rejects unsafe source-related and filesystem-root targets", () => {
  const sourceParent = path.dirname(SKILL_ROOT);
  for (const target of [sourceParent, SKILL_ROOT, path.parse(SKILL_ROOT).root]) {
    const result = runInstaller(["--json", "--target", target, "--apply"]);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).status, "INSTALL_TARGET_INVALID");
  }
});

test("rejects a symlink target that resolves back to the source", {
  skip: process.platform === "win32",
}, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yunxiao-install-link-"));
  const target = path.join(directory, "skills-link");
  await symlink(path.dirname(SKILL_ROOT), target, "dir");

  const result = runInstaller(["--json", "--target", target, "--apply"]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).status, "INSTALL_TARGET_INVALID");
});

test("uses AGENT_SKILLS_DIR only when --target is absent", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-env-"));
  const result = runInstaller(["--json"], { AGENT_SKILLS_DIR: target });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).destination, path.join(target, "yunxiao-project-lifecycle"));
});

test("never emits credential environment variables", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-secret-"));
  const secret = "secret-value-that-must-never-appear";
  const result = runInstaller(["--json", "--target", target], { YUNXIAO_ACCESS_TOKEN: secret });
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(secret));
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /YUNXIAO_ACCESS_TOKEN/);
});
