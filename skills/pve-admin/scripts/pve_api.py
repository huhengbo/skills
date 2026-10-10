#!/usr/bin/env python3
"""Dependency-free Proxmox VE API client. Reads credentials only from env.

Env: PVE_BASE_URL (https://host:8006), PVE_API_TOKEN (user@realm!tokenid=secret),
optional PVE_CA_FILE (trusted CA/self-signed cert PEM) or PVE_INSECURE_TLS=1.
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


def tls_context():
    if os.environ.get("PVE_INSECURE_TLS") == "1":
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return ssl.create_default_context(cafile=os.environ.get("PVE_CA_FILE") or None)


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("method", choices=["GET", "POST", "PUT", "DELETE"])
    p.add_argument("path", help="API path, e.g. /nodes or /nodes/pve1/qemu")
    p.add_argument("--data", help="JSON request body (object)")
    p.add_argument("--query", action="append", default=[], help="key=value")
    p.add_argument("--yes", action="store_true", help="allow a mutating request")
    a = p.parse_args(argv)
    check_write_guard(a.method, a.yes)
    base, token = os.environ.get("PVE_BASE_URL", ""), os.environ.get("PVE_API_TOKEN", "")
    if not base or not token:
        raise SystemExit("Set PVE_BASE_URL and PVE_API_TOKEN")
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
