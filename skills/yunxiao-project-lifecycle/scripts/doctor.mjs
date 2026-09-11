#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { CAPABILITY_PROFILES, runDoctor } from "./lib/doctor-core.mjs";

const CAPABILITY_NAMES = Object.freeze(Object.keys(CAPABILITY_PROFILES));
const HELP = `Usage: node scripts/doctor.mjs [options]

Run read-only Yunxiao MCP and project-binding diagnostics for one requested capability scope.

Options:
  --json                  Print machine-readable JSON
  --project-root <path>   Directory containing yunxiao.toml (default: cwd)
  --capability <profile>  Requested scope (default: project-read)
                          ${CAPABILITY_NAMES.join(", ")}
  --platform <value>      Override platform branch for tests
  --help                  Show this help
`;

function parseArguments(argv) {
  const options = {
    json: false,
    projectRoot: process.cwd(),
    platform: process.platform,
    capability: "project-read",
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
      case "--capability":
        if (!argv[index + 1] || !CAPABILITY_NAMES.includes(argv[index + 1])) {
          throw new Error(`--capability must be one of: ${CAPABILITY_NAMES.join(", ")}`);
        }
        options.capability = argv[index + 1];
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
  console.log(`Capability profile: ${result.capabilities.profile}`);
  console.log(`MCP protocol: ${result.protocol.era ?? "unresolved"}${result.protocol.version ? ` (${result.protocol.version})` : ""}`);
  if (result.protocol.toolPages > 0) {
    console.log(`Tool catalog pages: ${result.protocol.toolPages}`);
  }
  console.log(`Token configured: ${result.token.present ? "yes" : "no"}`);
  if (result.token.source) {
    console.log(`Token environment: ${result.token.source}`);
  }
  console.log(`Project binding: ${result.binding.status}`);
  console.log(`Region endpoint configured: ${result.endpoint.regionConfigured ? "yes" : "no"}`);
  if (result.capabilities.missing.length > 0) {
    console.log(`Missing capabilities: ${result.capabilities.missing.join(", ")}`);
  }
  if (result.capabilities.contractMissing.length > 0) {
    console.log(`Missing/invalid tool contracts: ${result.capabilities.contractMissing.join(", ")}`);
  }
  console.log(`Read preflight ready: ${result.readOnlyReady ? "yes" : "no"}`);
  console.log(`Write preflight ready: ${result.writePreflightReady ? "yes" : "no"}`);
  console.log("Target/workflow authorization: not evaluated by doctor");
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
      capability: options.capability,
      protocolMode: "auto",
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHuman(result);
    }
    process.exitCode = result.status === "READY" ? 0 : 2;
  } catch {
    const result = {
      status: "CONFIG_ERROR",
      readOnlyReady: false,
      writeReady: false,
      writePreflightReady: false,
    };
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error("Yunxiao doctor: CONFIG_ERROR");
    }
    process.exitCode = 1;
  }
}

await main();
