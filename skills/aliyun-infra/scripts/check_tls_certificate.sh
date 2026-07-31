#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: check_tls_certificate.sh --host <domain> [--port <port>] [--samples <count>] [--interval <seconds>] [--expected-serial <serial>] [--require-valid]

Repeatedly fetches the leaf TLS certificate and reports whether all samples
served one serial number. Use --expected-serial to verify that the new
certificate is serving, and --require-valid to fail when it is expired.
EOF
}

host=""
port="443"
samples="8"
interval="5"
expected_serial=""
require_valid="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      host="${2:-}"
      shift 2
      ;;
    --port)
      port="${2:-}"
      shift 2
      ;;
    --samples)
      samples="${2:-}"
      shift 2
      ;;
    --interval)
      interval="${2:-}"
      shift 2
      ;;
    --expected-serial)
      expected_serial="${2:-}"
      shift 2
      ;;
    --require-valid)
      require_valid="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

expected_serial="$(printf '%s' "$expected_serial" | tr -d ':' | tr '[:lower:]' '[:upper:]')"
if [[ -z "$host" || ! "$port" =~ ^[0-9]+$ || ! "$samples" =~ ^[1-9][0-9]*$ || ! "$interval" =~ ^[0-9]+$ || ( -n "$expected_serial" && ! "$expected_serial" =~ ^[0-9A-F]+$ ) ]]; then
  usage >&2
  exit 2
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Sampling ${host}:${port} ${samples} time(s), ${interval}s apart"
for ((sample = 1; sample <= samples; sample++)); do
  certificate_file="$tmp_dir/certificate-$sample.pem"
  if ! openssl s_client -connect "${host}:${port}" -servername "$host" < /dev/null 2>"$tmp_dir/error-$sample.log" \
      | openssl x509 -outform PEM > "$certificate_file" 2>/dev/null; then
    echo "sample=${sample} result=connection-or-certificate-error" >&2
    sed -n '1,3p' "$tmp_dir/error-$sample.log" >&2 || true
    continue
  fi

  certificate_info="$(openssl x509 -in "$certificate_file" -noout -serial -dates -subject)"
  serial="$(printf '%s\n' "$certificate_info" | awk -F= '/^serial=/{print $2}')"
  not_after="$(printf '%s\n' "$certificate_info" | awk -F= '/^notAfter=/{print $2}')"
  subject="$(printf '%s\n' "$certificate_info" | sed -n 's/^subject=//p')"
  if [[ -z "$serial" ]]; then
    echo "sample=${sample} result=certificate-without-serial" >&2
    continue
  fi
  printf '%s\n' "$serial" > "$tmp_dir/serial-$sample"
  if openssl x509 -in "$certificate_file" -checkend 0 -noout > /dev/null 2>&1; then
    validity="valid"
  else
    validity="expired"
  fi
  printf '%s\n' "$validity" > "$tmp_dir/validity-$sample"
  printf 'sample=%s serial=%s validity=%s notAfter=%s subject=%s\n' "$sample" "$serial" "$validity" "$not_after" "$subject"
done

serial_count="$(find "$tmp_dir" -maxdepth 1 -type f -name 'serial-*' -exec cat {} + | sort | uniq -c || true)"
if [[ -z "$serial_count" ]]; then
  echo "RESULT=NO_CERTIFICATE_SAMPLES" >&2
  exit 1
fi

printf '\nSerial distribution:\n%s\n' "$serial_count"
if [[ "$(printf '%s\n' "$serial_count" | wc -l | tr -d ' ')" -ne 1 ]]; then
  echo "RESULT=MIXED_EDGE_CERTIFICATES"
  exit 3
fi

observed_serial="$(printf '%s\n' "$serial_count" | awk '{print $2}')"
invalid_count="$(find "$tmp_dir" -maxdepth 1 -type f -name 'validity-*' -exec cat {} + | awk '$1 != "valid" {count++} END {print count + 0}')"
if [[ -n "$expected_serial" && "$observed_serial" != "$expected_serial" ]]; then
  echo "RESULT=UNEXPECTED_CERTIFICATE expected=${expected_serial} observed=${observed_serial}" >&2
  exit 4
fi
if [[ "$require_valid" == "true" && "$invalid_count" -gt 0 ]]; then
  echo "RESULT=EXPIRED_CERTIFICATE serial=${observed_serial}" >&2
  exit 4
fi

echo "RESULT=CONVERGED serial=${observed_serial}"
