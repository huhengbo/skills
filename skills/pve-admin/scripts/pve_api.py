#!/usr/bin/env python3
"""Dependency-free Proxmox VE API client. Reads credentials only from env.

Env per instance NAME: PVE_<NAME>_BASE_URL (https://host:8006) and
PVE_<NAME>_API_TOKEN (user@realm!tokenid=secret); select with --instance NAME.
A single unnamed instance may use PVE_BASE_URL / PVE_API_TOKEN.
Missing variables are also read from ~/.pve.env (or PVE_ENV_FILE) as `export K='V'` lines,
because agent sessions do not always inherit the shell profile.
Optional PVE_CA_FILE (trusted CA/self-signed cert PEM) or PVE_INSECURE_TLS=1.
Mutations (non-GET) are refused unless --yes is given.
"""
import argparse
import json
import os
import ssl
import sys
from urllib import error, parse, request

MUTATING = {"POST", "PUT", "DELETE"}


def check_write_guard(method, yes):
    if method in MUTATING and not yes:
        raise SystemExit(f"Refusing {method} without --yes; confirm target and impact with the user first")


def build_url(base, path, query):
    path = path if path.startswith("/api2/") else "/api2/json/" + path.lstrip("/")
    qs = parse.urlencode([tuple(q.split("=", 1)) for q in query if "=" in q])
    return base.rstrip("/") + path + ("?" + qs if qs else "")


def load_env_file(env, path=None):
    """Fill unset PVE_* keys in env from an export-style file; real env wins."""
    path = path or env.get("PVE_ENV_FILE") or os.path.join(os.path.expanduser("~"), ".pve.env")
    try:
        lines = open(path, encoding="utf-8").read().splitlines()
    except OSError:
        return env
    for line in lines:
        line = line.strip()
        if line.startswith("export "):
            line = line[7:]
        key, sep, value = line.partition("=")
        key = key.strip()
        if sep and key.startswith("PVE_") and key not in env:
            env[key] = value.strip().strip("'\"")
    return env


def list_instances(env):
    return sorted(k[4:-9].lower() for k in env if k.startswith("PVE_") and k.endswith("_BASE_URL") and len(k) > 13)


def resolve_instance(env, name):
    """Return (base_url, token) for the named instance, or the unnamed default."""
    names = list_instances(env)
    if not name and not env.get("PVE_BASE_URL"):
        if len(names) == 1:
            name = names[0]
        elif names:
            raise SystemExit("Multiple instances configured; pass --instance one of: " + ", ".join(names))
    prefix = f"PVE_{name.upper()}_" if name else "PVE_"
    base, token = env.get(prefix + "BASE_URL", ""), env.get(prefix + "API_TOKEN", "")
    if not base or not token:
        raise SystemExit(f"Set {prefix}BASE_URL and {prefix}API_TOKEN" + (f" (known instances: {', '.join(names)})" if names else ""))
    return base, token


def tls_context():
    if os.environ.get("PVE_INSECURE_TLS") == "1":
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return ssl.create_default_context(cafile=os.environ.get("PVE_CA_FILE") or None)


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("method", choices=["GET", "POST", "PUT", "DELETE", "LIST"], help="LIST prints configured instance names")
    p.add_argument("path", nargs="?", default="", help="API path, e.g. /nodes or /nodes/pve1/qemu")
    p.add_argument("--instance", default=os.environ.get("PVE_INSTANCE", ""), help="instance name (PVE_<NAME>_*)")
    p.add_argument("--data", help="JSON request body (object)")
    p.add_argument("--query", action="append", default=[], help="key=value")
    p.add_argument("--yes", action="store_true", help="allow a mutating request")
    a = p.parse_args(argv)
    load_env_file(os.environ)
    if a.method == "LIST":
        print("\n".join(list_instances(os.environ)))
        return
    if not a.path:
        raise SystemExit("path is required")
    check_write_guard(a.method, a.yes)
    base, token = resolve_instance(os.environ, a.instance)
    headers = {"Authorization": "PVEAPIToken=" + token, "Accept": "application/json"}
    body = None
    if a.data:
        body = a.data.encode()
        headers["Content-Type"] = "application/json"
    req = request.Request(build_url(base, a.path, a.query), data=body, method=a.method, headers=headers)
    try:
        with request.urlopen(req, timeout=30, context=tls_context()) as r:
            print(r.read().decode())
    except error.HTTPError as e:
        print(json.dumps({"http_status": e.code, "reason": e.reason, "body": e.read().decode(errors="replace")}), file=sys.stderr)
        raise SystemExit(1)
    except (error.URLError, ssl.SSLError) as e:
        raise SystemExit(f"Request failed: {e.reason if hasattr(e, 'reason') else e}")


if __name__ == "__main__":
    main()
