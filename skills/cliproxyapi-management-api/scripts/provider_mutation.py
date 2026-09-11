#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

COLLECTIONS = {
    "openai-compatibility",
    "gemini-api-key",
    "claude-api-key",
    "codex-api-key",
    "vertex-api-key",
}
SECRET_KEYS = {
    "api-key",
    "api_key",
    "management-key",
    "management_key",
    "authorization",
    "token",
    "secret",
    "secret-key",
    "secret_key",
}
DEFAULT_TIMEOUT = 20


class SafeMutationError(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SafeMutationError(f"redirect blocked: HTTP {code}")


def validate_base_url(value: str) -> str:
    raw = value.strip().rstrip("/")
    if not raw:
        raise SafeMutationError("CLIPROXYAPI_BASE_URL is required")
    parsed = urllib.parse.urlsplit(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise SafeMutationError("base URL must be an absolute http(s) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise SafeMutationError("base URL must not contain credentials, query, or fragment")
    if parsed.scheme == "http" and parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise SafeMutationError("remote management endpoints must use HTTPS")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", ""))


def load_config() -> tuple[str, str, int]:
    base_url = validate_base_url(os.environ.get("CLIPROXYAPI_BASE_URL", ""))
    key = os.environ.get("CLIPROXYAPI_MANAGEMENT_KEY", "").strip()
    if not key:
        raise SafeMutationError("CLIPROXYAPI_MANAGEMENT_KEY is required")
    try:
        timeout = int(os.environ.get("CLIPROXYAPI_TIMEOUT", str(DEFAULT_TIMEOUT)))
    except ValueError as exc:
        raise SafeMutationError("CLIPROXYAPI_TIMEOUT must be an integer") from exc
    if timeout <= 0:
        raise SafeMutationError("CLIPROXYAPI_TIMEOUT must be positive")
    return base_url, key, timeout


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def state_hash(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            if key.lower() in SECRET_KEYS or any(token in key.lower() for token in ("password", "cookie")):
                out[key] = "<redacted>"
            else:
                out[key] = redact(item)
        return out
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def endpoint(base_url: str, collection: str) -> str:
    if collection not in COLLECTIONS:
        raise SafeMutationError(f"unsupported collection: {collection}")
    return f"{base_url}/v0/management/{collection}"


def opener() -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(NoRedirect())


def request_json(base_url: str, key: str, timeout: int, method: str, collection: str, body: Any | None = None) -> Any:
    url = endpoint(base_url, collection)
    payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {"Accept": "application/json", "X-Management-Key": key}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with opener().open(req, timeout=timeout) as response:
            text = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        raise SafeMutationError(f"HTTP {exc.code} from {collection}") from exc
    except urllib.error.URLError as exc:
        raise SafeMutationError(f"request failed for {collection}: {exc.reason}") from exc
    except SafeMutationError:
        raise
    try:
        return json.loads(text) if text.strip() else None
    except json.JSONDecodeError as exc:
        raise SafeMutationError(f"non-JSON response from {collection}") from exc


def secure_backup_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    try:
        path.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
    except OSError:
        pass


def write_backup(directory: Path, collection: str, state: Any) -> Path:
    secure_backup_dir(directory)
    digest = state_hash(state)
    fd, temp_name = tempfile.mkstemp(prefix=f"{collection}-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        try:
            os.chmod(temp_name, stat.S_IRUSR | stat.S_IWUSR)
        except OSError:
            pass
        final_path = directory / f"{collection}-{digest[:12]}.json"
        os.replace(temp_name, final_path)
        return final_path
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def read_json_file(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SafeMutationError(f"cannot read JSON input: {path}") from exc


def require_expected(current: Any, expected_sha256: str) -> str:
    current_hash = state_hash(current)
    if current_hash != expected_sha256.lower():
        raise SafeMutationError(f"CONFLICT current_sha256={current_hash}")
    return current_hash


def cmd_snapshot(args: argparse.Namespace) -> dict[str, Any]:
    base_url, key, timeout = load_config()
    current = request_json(base_url, key, timeout, "GET", args.collection)
    digest = state_hash(current)
    result: dict[str, Any] = {"status": "SNAPSHOT", "collection": args.collection, "sha256": digest}
    if args.backup_dir:
        backup = write_backup(Path(args.backup_dir), args.collection, current)
        result["backup_file"] = str(backup)
    result["preview"] = redact(current)
    return result


def cmd_replace(args: argparse.Namespace) -> dict[str, Any]:
    if not args.confirm_replace:
        raise SafeMutationError("replace requires --confirm-replace")
    base_url, key, timeout = load_config()
    proposed = read_json_file(Path(args.input))
    current = request_json(base_url, key, timeout, "GET", args.collection)
    previous_hash = require_expected(current, args.expected_sha256)
    backup = write_backup(Path(args.backup_dir), args.collection, current)
    request_json(base_url, key, timeout, "PUT", args.collection, proposed)
    observed = request_json(base_url, key, timeout, "GET", args.collection)
    if state_hash(observed) != state_hash(proposed):
        raise SafeMutationError("SUBMITTED_UNVERIFIED: post-write state does not match requested replacement")
    return {
        "status": "VERIFIED_SUCCESS",
        "collection": args.collection,
        "previous_sha256": previous_hash,
        "new_sha256": state_hash(observed),
        "backup_file": str(backup),
    }


def cmd_patch(args: argparse.Namespace) -> dict[str, Any]:
    if not args.confirm_write:
        raise SafeMutationError("patch requires --confirm-write")
    base_url, key, timeout = load_config()
    patch_body = read_json_file(Path(args.input))
    current = request_json(base_url, key, timeout, "GET", args.collection)
    previous_hash = require_expected(current, args.expected_sha256)
    backup = write_backup(Path(args.backup_dir), args.collection, current)
    request_json(base_url, key, timeout, "PATCH", args.collection, patch_body)
    observed = request_json(base_url, key, timeout, "GET", args.collection)
    observed_hash = state_hash(observed)
    if observed_hash == previous_hash:
        raise SafeMutationError("SUBMITTED_UNVERIFIED: remote state did not change")
    return {
        "status": "VERIFIED_CHANGED",
        "collection": args.collection,
        "previous_sha256": previous_hash,
        "observed_sha256": observed_hash,
        "backup_file": str(backup),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Conflict-aware CLIProxyAPI provider mutation helper")
    sub = parser.add_subparsers(dest="command", required=True)

    snapshot = sub.add_parser("snapshot")
    snapshot.add_argument("collection", choices=sorted(COLLECTIONS))
    snapshot.add_argument("--backup-dir")
    snapshot.set_defaults(func=cmd_snapshot)

    replace = sub.add_parser("replace")
    replace.add_argument("collection", choices=sorted(COLLECTIONS))
    replace.add_argument("--input", required=True)
    replace.add_argument("--expected-sha256", required=True)
    replace.add_argument("--backup-dir", required=True)
    replace.add_argument("--confirm-replace", action="store_true")
    replace.set_defaults(func=cmd_replace)

    patch = sub.add_parser("patch")
    patch.add_argument("collection", choices=sorted(COLLECTIONS))
    patch.add_argument("--input", required=True)
    patch.add_argument("--expected-sha256", required=True)
    patch.add_argument("--backup-dir", required=True)
    patch.add_argument("--confirm-write", action="store_true")
    patch.set_defaults(func=cmd_patch)

    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        result = args.func(args)
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except SafeMutationError as exc:
        print(json.dumps({"status": "ERROR", "message": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
