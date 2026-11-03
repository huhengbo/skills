#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { readBinding } from "./lib/binding.mjs";
import { OpenApiError, createClient, summarize } from "./lib/openapi.mjs";

const HELP = `Usage: node scripts/workitems.mjs <command> [arguments] [options]

Work-item operations the official Yunxiao MCP does not expose, via the official Projex OpenAPI.
Targets are serial numbers (e.g. DEMO-12) or work-item IDs inside the yunxiao.toml-bound project.

Read commands:
  get <target>                         Title, status and description
  tree <target>                        Child hierarchy (SUB relations) with statuses
  relations <target> [--type <type>]   PARENT, SUB, ASSOCIATED (default), DEPEND_ON, DEPENDED_BY

Write commands (dry run unless --apply; each verifies by reading back):
  relate <source> <target> [--type <type>]   SUB (target becomes child), ASSOCIATED (default), DEPEND_ON
  set-description <target> <markdown-file>   Replace the whole description (MARKDOWN)

Options:
  --project-root <path>   Directory containing yunxiao.toml (default: cwd)
  --apply                 Submit the write
  --json                  Print machine-readable JSON
  --help                  Show this help
`;

function parseArguments(argv) {
  const options = { projectRoot: process.cwd(), apply: false, json: false, type: null, help: false, positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--apply") options.apply = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--project-root" || argument === "--type") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new OpenApiError("USAGE", `${argument} requires a value`);
      if (argument === "--type") options.type = value.toUpperCase();
      else options.projectRoot = value;
      index += 1;
    } else if (argument.startsWith("--")) throw new OpenApiError("USAGE", `unknown option ${argument}`);
    else options.positional.push(argument);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [command, ...rest] = options.positional;
  if (options.help || !command) {
    process.stdout.write(HELP);
    return 0;
  }

  const binding = await readBinding(path.join(path.resolve(options.projectRoot), "yunxiao.toml"));
  const client = createClient({ binding });
  const print = (value, text) => process.stdout.write(`${options.json ? JSON.stringify(value, null, 2) : text}\n`);

  switch (command) {
    case "get": {
      const item = await client.resolve(rest[0] ?? "");
      print(item, `${summarize(item)}\n\n${item.description ?? ""}`);
      return 0;
    }
    case "tree": {
      const rows = await client.tree(rest[0] ?? "");
      print(rows.map(({ depth, item }) => ({ depth, serialNumber: item.serialNumber, status: item.status?.displayName, subject: item.subject })),
        rows.map(({ depth, item }) => `${"  ".repeat(depth)}${summarize(item)}`).join("\n"));
      return 0;
    }
    case "relations": {
      const item = await client.resolve(rest[0] ?? "");
      const type = options.type ?? "ASSOCIATED";
      const related = [];
      for (const record of await client.relations(item.id, type)) related.push(await client.getById(record.resourceId));
      print(related.map((entry) => ({ relationType: type, serialNumber: entry.serialNumber, subject: entry.subject })),
        related.map((entry) => `${type} ${summarize(entry)}`).join("\n") || "(none)");
      return 0;
    }
    case "relate": {
      if (rest.length !== 2) throw new OpenApiError("USAGE", "relate needs <source> <target>");
      const result = await client.relate(rest[0], rest[1], options.type ?? "ASSOCIATED", { apply: options.apply });
      print(result, `${result.status} ${result.source} ${result.relationType} ${result.target}${result.note ? ` (${result.note})` : ""}${result.error ? `: ${result.error}` : ""}`);
      return result.status === "VERIFIED_SUCCESS" || result.status === "DRY_RUN" ? 0 : 1;
    }
    case "set-description": {
      if (rest.length !== 2) throw new OpenApiError("USAGE", "set-description needs <target> <markdown-file>");
      const description = await readFile(rest[1], "utf8");
      const result = await client.setDescription(rest[0], description, { apply: options.apply });
      print(result, `${result.status} ${result.target} (${result.currentLength} -> ${result.newLength} chars)${result.note ? ` (${result.note})` : ""}${result.error ? `: ${result.error}` : ""}`);
      return result.status === "VERIFIED_SUCCESS" || result.status === "DRY_RUN" ? 0 : 1;
    }
    default:
      throw new OpenApiError("USAGE", `unknown command ${command}`);
  }
}

main().then((code) => { process.exitCode = code; }, (error) => {
  const status = error instanceof OpenApiError ? error.status : "FAILED";
  process.stderr.write(`${status}: ${error.message}\n`);
  if (status === "USAGE") process.stderr.write(HELP);
  process.exitCode = 2;
});
