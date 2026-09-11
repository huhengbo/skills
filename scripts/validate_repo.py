#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = ROOT / "skills"
MANIFEST = ROOT / "skills-manifest.json"
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"

REQUIRED_GITIGNORE = {
    ".env",
    ".env.*",
    "!.env.example",
    "!.env.template",
    "*.log",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
}

SECRET_PATTERNS = (
    ("private-key-block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github-token", re.compile(r"\bgh[opusr]_[A-Za-z0-9]{30,}\b")),
    ("openai-style-key", re.compile(r"\bsk-[A-Za-z0-9_-]{32,}\b")),
)

TEXT_SUFFIXES = {
    ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".py", ".mjs", ".js", ".sh", ".ps1", ".xml",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_frontmatter(text: str) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("missing opening frontmatter delimiter")
    try:
        end = next(index for index, line in enumerate(lines[1:], start=1) if line.strip() == "---")
    except StopIteration as exc:
        raise ValueError("missing closing frontmatter delimiter") from exc
    values: dict[str, str] = {}
    for line in lines[1:end]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip().strip('"\'')
    return values


def skill_dirs() -> list[Path]:
    return sorted(path for path in SKILLS_DIR.iterdir() if path.is_dir())


def validate_structure(errors: list[str]) -> None:
    try:
        manifest = read_json(MANIFEST)
        marketplace = read_json(MARKETPLACE)
    except Exception as exc:
        errors.append(f"metadata: cannot parse manifest/marketplace ({type(exc).__name__})")
        return

    manifest_entries = {item["name"]: item for item in manifest.get("skills", []) if isinstance(item, dict) and item.get("name")}
    actual_names = {path.name for path in skill_dirs()}
    if set(manifest_entries) != actual_names:
        errors.append("metadata: skills-manifest.json names do not exactly match skills/* directories")

    market_entries = {item["name"]: item for item in marketplace.get("plugins", []) if isinstance(item, dict) and item.get("name")}
    expected_market_names = {name for name, item in manifest_entries.items() if item.get("claude_marketplace") is True}
    if set(market_entries) != expected_market_names:
        errors.append("metadata: marketplace plugin names do not match manifest claude_marketplace=true entries")

    for directory in skill_dirs():
        name = directory.name
        skill_md = directory / "SKILL.md"
        if not skill_md.is_file():
            errors.append(f"{name}: missing SKILL.md")
            continue
        try:
            text = skill_md.read_text(encoding="utf-8")
            frontmatter = parse_frontmatter(text)
        except Exception as exc:
            errors.append(f"{name}: invalid SKILL.md frontmatter ({type(exc).__name__})")
            continue

        if frontmatter.get("name") != name:
            errors.append(f"{name}: frontmatter name does not match directory")
        if not frontmatter.get("description"):
            errors.append(f"{name}: frontmatter description is required")

        for relative in re.findall(r"\]\(((?:references|scripts|assets)/[^)#\s]+)", text):
            if not (directory / relative).exists():
                errors.append(f"{name}: referenced path does not exist: {relative}")

        entry = manifest_entries.get(name)
        if not entry:
            continue
        version = entry.get("version")
        if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version):
            errors.append(f"{name}: manifest version must be semantic x.y.z")

        if entry.get("claude_marketplace") is True:
            plugin_path = directory / ".claude-plugin" / "plugin.json"
            if not plugin_path.is_file():
                errors.append(f"{name}: missing .claude-plugin/plugin.json")
                continue
            try:
                plugin = read_json(plugin_path)
            except Exception as exc:
                errors.append(f"{name}: invalid plugin.json ({type(exc).__name__})")
                continue
            market = market_entries.get(name, {})
            if plugin.get("name") != name or market.get("name") != name:
                errors.append(f"{name}: plugin/marketplace name mismatch")
            if plugin.get("version") != version or market.get("version") != version:
                errors.append(f"{name}: manifest/plugin/marketplace version mismatch")
            if market.get("source") != f"./skills/{name}":
                errors.append(f"{name}: marketplace source mismatch")


def validate_gitignore(errors: list[str]) -> None:
    path = ROOT / ".gitignore"
    if not path.is_file():
        errors.append("repository: missing .gitignore")
        return
    lines = {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.lstrip().startswith("#")}
    missing = sorted(REQUIRED_GITIGNORE - lines)
    if missing:
        errors.append("repository: .gitignore missing required secret/local-artifact patterns: " + ", ".join(missing))


def validate_secret_hygiene(errors: list[str]) -> None:
    forbidden_names = {".env", ".env.local", ".env.production", ".env.development"}
    forbidden_suffixes = {".pem", ".key", ".p12", ".pfx"}
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        relative = path.relative_to(ROOT)
        if path.name in forbidden_names or path.suffix.lower() in forbidden_suffixes:
            errors.append(f"secret-hygiene: forbidden tracked/local artifact present: {relative.as_posix()}")
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in {"Dockerfile", "Makefile"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(text):
                errors.append(f"secret-hygiene: {label} pattern found in {relative.as_posix()}")


def run(command: list[str]) -> int:
    print("+", " ".join(command))
    return subprocess.run(command, cwd=ROOT, check=False).returncode


def run_tests(errors: list[str]) -> None:
    python_test_dirs = sorted({path.parent for path in ROOT.rglob("test_*.py") if ".git" not in path.parts})
    for directory in python_test_dirs:
        relative = directory.relative_to(ROOT)
        code = run([sys.executable, "-m", "unittest", "discover", "-s", str(relative), "-p", "test_*.py"])
        if code != 0:
            errors.append(f"tests: Python unittest failed in {relative.as_posix()}")

    node_tests = sorted(path.relative_to(ROOT) for path in ROOT.rglob("*.test.mjs") if ".git" not in path.parts)
    if node_tests:
        node = shutil.which("node")
        if not node:
            errors.append("tests: node executable is required for *.test.mjs")
        else:
            code = run([node, "--test", *[str(path) for path in node_tests]])
            if code != 0:
                errors.append("tests: Node test suite failed")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the skills repository on Windows, macOS, and Linux.")
    parser.add_argument("--with-tests", action="store_true", help="Run all discovered Python and Node tests after static validation.")
    args = parser.parse_args()

    errors: list[str] = []
    validate_structure(errors)
    validate_gitignore(errors)
    validate_secret_hygiene(errors)
    if args.with_tests:
        run_tests(errors)

    if errors:
        print("VALIDATION_FAILED", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("VALIDATION_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
