#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if command -v python3 >/dev/null 2>&1; then
  exec python3 "$SCRIPT_DIR/check_tls_certificate.py" "$@"
fi

if command -v python >/dev/null 2>&1; then
  exec python "$SCRIPT_DIR/check_tls_certificate.py" "$@"
fi

printf '%s\n' 'Python 3 is required. On Windows, run: python scripts/check_tls_certificate.py ...' >&2
exit 127
