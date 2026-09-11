#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "yunxiao-project-lifecycle";
const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

const HELP = `Usage: node scripts/install.mjs [options]

Install this portable Agent Skill into an explicitly selected skill directory.

Options:
  --target <path>       Parent skill directory (or set AGENT_SKILLS_DIR)
  --backup-root <path>  Backup root outside the active discovery directory
  --apply               Apply the installation; default is dry-run
  --json                Print machine-readable JSON
  --help                Show this help
`;

class InstallFailure extends Error {
  constructor(status, exitCode = 1) {
    super(status);
    this.status = status;
    this.exitCode = exitCode;
  }
}

function parseArguments(argv) {
  const options = { target: null, backupRoot: null, apply: false, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--target":
        if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
          throw new InstallFailure("SKILL_INSTALL_TARGET_REQUIRED", 2);
        }
        options.target = argv[index + 1];
        index += 1;
        break;
      case "--backup-root":
        if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
          throw new InstallFailure("INSTALL_BACKUP_ROOT_REQUIRED", 2);
        }
        options.backupRoot = argv[index + 1];
        index += 1;
        break;
      case "--apply":
        options.apply = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new InstallFailure("INSTALL_ARGUMENT_INVALID");
    }
  }
  return options;
}

function isSameOrDescendant(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function canonicalize(candidate) {
  let current = candidate;
  const missingParts = [];
  while (true) {
    try {
      return path.join(await realpath(current), ...missingParts);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missingParts.unshift(path.basename(current));
      current = parent;
    }
  }
}

async function resolvePaths(rawTarget, rawBackupRoot) {
  if (!rawTarget || CONTROL_CHARACTER.test(rawTarget)) {
    throw new InstallFailure("SKILL_INSTALL_TARGET_REQUIRED", 2);
  }
  const target = path.resolve(rawTarget);
  const destination = path.join(target, SKILL_NAME);
  const backupRoot = path.resolve(rawBackupRoot ?? path.join(path.dirname(target), ".skill-backups", SKILL_NAME));
  const [canonicalSource, canonicalTarget, canonicalDestination, canonicalBackupRoot] = await Promise.all([
    canonicalize(SOURCE_ROOT),
    canonicalize(target),
    canonicalize(destination),
    canonicalize(backupRoot),
  ]);
  if (
    canonicalTarget === path.parse(canonicalTarget).root
    || canonicalDestination === canonicalSource
    || isSameOrDescendant(canonicalSource, canonicalDestination)
    || isSameOrDescendant(canonicalTarget, canonicalBackupRoot)
  ) {
    throw new InstallFailure("INSTALL_TARGET_INVALID");
  }
  return { target, destination, backupRoot };
}

async function pathExists(candidate) {
  try {
    return await lstat(candidate);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function validateSkillRoot(root) {
  const skill = await readFile(path.join(root, "SKILL.md"), "utf8");
  if (!/^---\r?\nname:\s*yunxiao-project-lifecycle\s*$/m.test(skill)) {
    throw new InstallFailure("SKILL_INVALID");
  }
}

async function hashPath(root, current, hash) {
  const relative = path.relative(root, current).split(path.sep).join("/");
  const stat = await lstat(current);
  if (stat.isDirectory()) {
    hash.update(`D:${relative}\n`);
    const entries = (await readdir(current)).sort();
    for (const entry of entries) await hashPath(root, path.join(current, entry), hash);
    return;
  }
  if (stat.isSymbolicLink()) {
    hash.update(`L:${relative}:${await readlink(current)}\n`);
    return;
  }
  if (!stat.isFile()) throw new InstallFailure("SKILL_INVALID");
  hash.update(`F:${relative}:${stat.mode & 0o111 ? "x" : "-"}:`);
  hash.update(await readFile(current));
  hash.update("\n");
}

async function directoryDigest(root) {
  const hash = createHash("sha256");
  await hashPath(root, root, hash);
  return hash.digest("hex");
}

async function applyInstallation(target, destination, backupRoot) {
  await mkdir(target, { recursive: true, mode: 0o700 });
  const targetStat = await lstat(target);
  if (!targetStat.isDirectory()) throw new InstallFailure("INSTALL_TARGET_INVALID");

  const sourceDigest = await directoryDigest(SOURCE_ROOT);
  const existing = await pathExists(destination);
  if (existing) {
    if (!existing.isDirectory()) throw new InstallFailure("INSTALL_TARGET_INVALID");
    await validateSkillRoot(destination);
    const destinationDigest = await directoryDigest(destination);
    if (destinationDigest === sourceDigest) {
      return { status: "UNCHANGED", backup: null, digest: sourceDigest };
    }
  }

  const suffix = `${Date.now()}-${process.pid}`;
  const temporary = `${destination}.tmp-${suffix}`;
  let backup = null;
  await rm(temporary, { recursive: true, force: true });

  try {
    await cp(SOURCE_ROOT, temporary, {
      recursive: true,
      errorOnExist: true,
      force: false,
      verbatimSymlinks: true,
    });
    await validateSkillRoot(temporary);
    if (await directoryDigest(temporary) !== sourceDigest) throw new InstallFailure("INSTALL_VERIFY_FAILED");

    if (existing) {
      await mkdir(backupRoot, { recursive: true, mode: 0o700 });
      backup = path.join(backupRoot, `backup-${suffix}`);
      await rename(destination, backup);
    }

    try {
      await rename(temporary, destination);
    } catch (error) {
      if (backup) await rename(backup, destination);
      throw error;
    }

    await validateSkillRoot(destination);
    if (await directoryDigest(destination) !== sourceDigest) {
      await rm(destination, { recursive: true, force: true });
      if (backup) await rename(backup, destination);
      throw new InstallFailure("INSTALL_VERIFY_FAILED");
    }
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (error instanceof InstallFailure) throw error;
    throw new InstallFailure("INSTALL_FAILED");
  }

  return { status: "INSTALLED", backup, digest: sourceDigest };
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Yunxiao Skill installer: ${result.status}`);
  if (result.destination) console.log(`Destination: ${result.destination}`);
  if (result.backup) console.log(`Backup: ${result.backup}`);
}

async function main() {
  let options = { json: process.argv.includes("--json") };
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }

    const rawTarget = options.target ?? process.env.AGENT_SKILLS_DIR;
    const { target, destination, backupRoot } = await resolvePaths(rawTarget, options.backupRoot);
    await validateSkillRoot(SOURCE_ROOT);

    if (!options.apply) {
      printResult({ status: "DRY_RUN", destination, backupRoot, applyRequired: true }, options.json);
      return;
    }

    const applied = await applyInstallation(target, destination, backupRoot);
    printResult({ ...applied, destination, backupRoot }, options.json);
  } catch (error) {
    const failure = error instanceof InstallFailure ? error : new InstallFailure("INSTALL_FAILED");
    printResult({ status: failure.status }, options.json);
    process.exitCode = failure.exitCode;
  }
}

await main();
