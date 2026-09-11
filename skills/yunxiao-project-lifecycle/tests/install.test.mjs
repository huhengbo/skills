import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
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

test("dry-run reports destination and backup root without creating them", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-dry-"));
  const backupRoot = `${target}-backups`;
  const result = runInstaller(["--json", "--target", target, "--backup-root", backupRoot]);
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.status, "DRY_RUN");
  assert.equal(output.destination, path.join(target, "yunxiao-project-lifecycle"));
  assert.equal(output.backupRoot, path.resolve(backupRoot));
  await assert.rejects(access(output.destination));
  await assert.rejects(access(output.backupRoot));
});

test("apply installs the complete portable skill", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-apply-"));
  const result = runInstaller(["--json", "--target", target, "--apply"]);
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.status, "INSTALLED");
  assert.match(output.digest, /^[a-f0-9]{64}$/);
  const skill = await readFile(path.join(output.destination, "SKILL.md"), "utf8");
  assert.match(skill, /^---\r?\nname: yunxiao-project-lifecycle/m);
  await access(path.join(output.destination, "scripts", "doctor.mjs"));
});

test("identical reinstall is idempotent and creates no backup", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-idempotent-"));
  const backupRoot = `${target}-backups`;
  const first = runInstaller(["--json", "--target", target, "--backup-root", backupRoot, "--apply"]);
  assert.equal(first.status, 0);

  const second = runInstaller(["--json", "--target", target, "--backup-root", backupRoot, "--apply"]);
  const output = JSON.parse(second.stdout);
  assert.equal(second.status, 0);
  assert.equal(output.status, "UNCHANGED");
  assert.equal(output.backup, null);
  await assert.rejects(access(backupRoot));
});

test("changed installation is backed up outside active discovery directory", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-backup-"));
  const backupRoot = `${target}-backups`;
  const first = runInstaller(["--json", "--target", target, "--backup-root", backupRoot, "--apply"]);
  const firstOutput = JSON.parse(first.stdout);
  assert.equal(first.status, 0);

  await writeFile(path.join(firstOutput.destination, "local-drift.txt"), "drift\n", "utf8");
  const second = runInstaller(["--json", "--target", target, "--backup-root", backupRoot, "--apply"]);
  const output = JSON.parse(second.stdout);
  assert.equal(second.status, 0);
  assert.equal(output.status, "INSTALLED");
  assert.ok(output.backup);
  assert.equal(path.relative(target, output.backup).startsWith(".."), true);
  assert.equal(path.relative(backupRoot, output.backup).startsWith(".."), false);
  await access(path.join(output.backup, "local-drift.txt"));
  await assert.rejects(access(path.join(output.destination, "local-drift.txt")));
});

test("rejects backup roots inside the active discovery directory", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "yunxiao-install-bad-backup-"));
  const backupRoot = path.join(target, ".backups");
  const result = runInstaller(["--json", "--target", target, "--backup-root", backupRoot, "--apply"]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).status, "INSTALL_TARGET_INVALID");
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
  const result = runInstaller(["--json", "--target", target], {
    ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN: secret,
    YUNXIAO_ACCESS_TOKEN: secret,
  });
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(secret));
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /(?:ALIBABA_CLOUD_)?YUNXIAO_ACCESS_TOKEN/);
});
