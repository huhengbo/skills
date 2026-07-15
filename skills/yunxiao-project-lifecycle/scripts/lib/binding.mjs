import { readFile } from "node:fs/promises";

const OPTIONAL_KINDS = new Set(["requirement", "bug", "task"]);
const ALLOWED_SECTIONS = new Map([
  ["organization", new Set(["id", "name"])],
  ["project", new Set(["id", "name", "custom_code"])],
  ...[...OPTIONAL_KINDS].map((kind) => [`workitem_types.${kind}`, new Set(["id", "name"])]),
  ...[...OPTIONAL_KINDS].map((kind) => [`assignees.${kind}`, new Set(["user_id", "name"])]),
]);

const PLACEHOLDER = /^<[^>]+>$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function stripComment(line) {
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quoted && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && character === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

function parseQuotedString(rawValue, location) {
  if (!rawValue.startsWith('"') || !rawValue.endsWith('"')) {
    throw new Error(`${location} must be a quoted string`);
  }

  let value;
  try {
    value = JSON.parse(rawValue);
  } catch (error) {
    throw new Error(`${location} contains an invalid quoted string: ${error.message}`);
  }

  if (typeof value !== "string") {
    throw new Error(`${location} must be a quoted string`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${location} must not be empty`);
  }
  if (CONTROL_CHARACTER.test(value)) {
    throw new Error(`${location} must not contain a control character`);
  }
  if (PLACEHOLDER.test(value.trim())) {
    throw new Error(`${location} contains a placeholder instead of a real value`);
  }

  return value;
}

function ensureObject(root, parts) {
  let cursor = root;
  for (const part of parts) {
    cursor[part] ??= {};
    cursor = cursor[part];
  }
  return cursor;
}

function requireField(object, location, key) {
  if (!Object.hasOwn(object, key)) {
    throw new Error(`${location}.${key} is required`);
  }
}

function validateBinding(binding) {
  if (binding.schema_version !== 1) {
    throw new Error(`unsupported schema_version ${String(binding.schema_version)}`);
  }

  requireField(binding.organization, "organization", "id");
  requireField(binding.project, "project", "id");

  for (const [groupName, identifierKey] of [
    ["workitem_types", "id"],
    ["assignees", "user_id"],
  ]) {
    for (const [kind, values] of Object.entries(binding[groupName])) {
      requireField(values, `${groupName}.${kind}`, identifierKey);
      requireField(values, `${groupName}.${kind}`, "name");
    }
  }

  return binding;
}

export function parseBinding(text) {
  if (typeof text !== "string") {
    throw new TypeError("binding content must be a string");
  }

  const binding = {
    schema_version: undefined,
    organization: {},
    project: {},
    workitem_types: {},
    assignees: {},
  };
  const seenKeys = new Set();
  const seenSections = new Set();
  let section = null;

  for (const [zeroBasedLine, sourceLine] of text.split(/\r?\n/).entries()) {
    const lineNumber = zeroBasedLine + 1;
    const line = stripComment(sourceLine).trim();
    if (!line) {
      continue;
    }

    const sectionMatch = line.match(/^\[([a-z0-9_.-]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      if (!ALLOWED_SECTIONS.has(section)) {
        throw new Error(`unsupported section ${section} at line ${lineNumber}`);
      }
      if (seenSections.has(section)) {
        throw new Error(`duplicate section ${section} at line ${lineNumber}`);
      }
      seenSections.add(section);
      ensureObject(binding, section.split("."));
      continue;
    }

    const assignmentMatch = line.match(/^([a-z_][a-z0-9_]*)\s*=\s*(.+)$/);
    if (!assignmentMatch) {
      throw new Error(`invalid assignment at line ${lineNumber}`);
    }
    const [, key, rawValue] = assignmentMatch;
    const location = section ? `${section}.${key}` : key;
    if (seenKeys.has(location)) {
      throw new Error(`duplicate key ${location} at line ${lineNumber}`);
    }

    if (section === null) {
      if (key !== "schema_version") {
        throw new Error(`unsupported top-level key ${key} at line ${lineNumber}`);
      }
      if (!/^\d+$/.test(rawValue)) {
        throw new Error("schema_version must be an integer");
      }
      binding.schema_version = Number(rawValue);
    } else {
      if (!ALLOWED_SECTIONS.get(section).has(key)) {
        throw new Error(`unsupported key ${location} at line ${lineNumber}`);
      }
      const target = ensureObject(binding, section.split("."));
      target[key] = parseQuotedString(rawValue, location);
    }
    seenKeys.add(location);
  }

  return validateBinding(binding);
}

export async function readBinding(filePath) {
  return parseBinding(await readFile(filePath, "utf8"));
}
