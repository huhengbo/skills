#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { runDoctor } from "./lib/doctor-core.mjs";

const HELP = `Usage: node scripts/doctor.mjs [options]

Run read-only Yunxiao MCP and project-binding diagnostics.

Options:
  --json                 Print machine-readable JSON
  --project-root <path>  Directory containing yunxiao.toml (default: cwd)
  --platform <value>     Override platform branch for tests
  --help                 Show this help
`;

function parseArguments(argv) {
  const options = {
    json: false,
    projectRoot: process.cwd(),
    platform: process.platform,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--project-root":
        if (!argv[index + 1]) {
          throw new Error("--project-root requires a path");
        }
        options.projectRoot = path.resolve(argv[index + 1]);
        index += 1;
        break;
      case "--platform":
        if (!argv[index + 1]) {
          throw new Error("--platform requires a value");
        }
        options.platform = argv[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`unknown option: ${argument}`);
    }
  }

  return options;
}

async function readBindingIfPresent(projectRoot) {
  try {
    return await readFile(path.join(projectRoot, "yunxiao.toml"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw new Error("cannot read yunxiao.toml from the selected project root");
  }
}

function printHuman(result) {
  console.log(`Yunxiao doctor: ${result.status}`);
  console.log(`Platform: ${result.platform}`);
  console.log(`Architecture: ${result.architecture}`);
  console.log(`Token configured: ${result.token.present ? "yes" : "no"}`);
  console.log(`Project binding: ${result.binding.status}`);
  console.log(`Region endpoint configured: ${result.endpoint.regionConfigured ? "yes" : "no"}`);
  if (result.capabilities.missing.length > 0) {
    console.log(`Missing capabilities: ${result.capabilities.missing.join(", ")}`);
  }
  console.log(`Read-only ready: ${result.readOnlyReady ? "yes" : "no"}`);
  console.log(`Write ready: ${result.writeReady ? "yes" : "no"}`);
}

async function main() {
  const majorVersion = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (majorVersion < 18) {
    console.error("Yunxiao doctor requires Node.js 18 or newer.");
    process.exitCode = 1;
    return;
  }

  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    process.stdout.write(HELP);
    return;
  }

  try {
    const result = await runDoctor({
      env: process.env,
      platform: options.platform,
      bindingText: await readBindingIfPresent(options.projectRoot),
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHuman(result);
    }
    process.exitCode = result.status === "READY" ? 0 : 2;
  } catch {
    const result = { status: "CONFIG_ERROR", readOnlyReady: false, writeReady: false };
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error("Yunxiao doctor: CONFIG_ERROR");
    }
    process.exitCode = 1;
  }
}

await main();
