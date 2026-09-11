#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import ssl
import sys
import tempfile
import time
from dataclasses import dataclass
from typing import Callable

DEFAULT_PORT = 443
DEFAULT_SAMPLES = 8
DEFAULT_INTERVAL_SECONDS = 5.0
DEFAULT_TIMEOUT_SECONDS = 10.0


class CheckError(Exception):
    pass


@dataclass(frozen=True)
class SampleResult:
    index: int
    success: bool
    serial: str | None = None
    fingerprint_sha256: str | None = None
    not_after: str | None = None
    expired: bool | None = None
    subject: str | None = None
    verification_ok: bool | None = None
    verification_error: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class Evaluation:
    status: str
    exit_code: int
    success_count: int
    failure_count: int
    required_success: int
    observed_serial: str | None = None


def normalize_serial(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.replace(":", "").strip().upper()
    return normalized or None


def _decode_der_certificate(der: bytes) -> dict:
    pem = ssl.DER_cert_to_PEM_cert(der)
    path = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="ascii", suffix=".pem", delete=False) as handle:
            handle.write(pem)
            path = handle.name
        return ssl._ssl._test_decode_cert(path)  # type: ignore[attr-defined]
    finally:
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass


def _subject_text(cert: dict) -> str | None:
    parts: list[str] = []
    for rdn in cert.get("subject", ()):
        for key, value in rdn:
            parts.append(f"{key}={value}")
    return ", ".join(parts) if parts else None


def _expiry_state(cert: dict) -> tuple[str | None, bool | None]:
    not_after = cert.get("notAfter")
    if not isinstance(not_after, str) or not not_after:
        return None, None
    try:
        expired = ssl.cert_time_to_seconds(not_after) <= time.time()
    except (ValueError, OverflowError):
        return not_after, None
    return not_after, expired


def _connect(host: str, port: int, timeout: float, verify: bool) -> tuple[dict, bytes]:
    context = ssl.create_default_context() if verify else ssl._create_unverified_context()
    if not verify:
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    with socket.create_connection((host, port), timeout=timeout) as raw:
        raw.settimeout(timeout)
        with context.wrap_socket(raw, server_hostname=host) as tls:
            der = tls.getpeercert(binary_form=True)
            if not der:
                raise CheckError("peer did not provide a certificate")
            cert = tls.getpeercert() if verify else _decode_der_certificate(der)
            return cert, der


def sample_certificate(host: str, port: int, timeout: float, index: int) -> SampleResult:
    verification_ok = True
    verification_error = None
    try:
        cert, der = _connect(host, port, timeout, verify=True)
    except ssl.SSLCertVerificationError as exc:
        verification_ok = False
        verification_error = exc.verify_message or "certificate verification failed"
        try:
            cert, der = _connect(host, port, timeout, verify=False)
        except Exception as fallback_exc:
            return SampleResult(index=index, success=False, error=type(fallback_exc).__name__)
    except (OSError, ssl.SSLError, CheckError) as exc:
        return SampleResult(index=index, success=False, error=type(exc).__name__)

    serial = normalize_serial(cert.get("serialNumber"))
    not_after, expired = _expiry_state(cert)
    fingerprint = hashlib.sha256(der).hexdigest().upper()
    return SampleResult(
        index=index,
        success=True,
        serial=serial,
        fingerprint_sha256=fingerprint,
        not_after=not_after,
        expired=expired,
        subject=_subject_text(cert),
        verification_ok=verification_ok,
        verification_error=verification_error,
    )


def collect_samples(
    *,
    host: str,
    port: int,
    samples: int,
    interval: float,
    timeout: float,
    overall_timeout: float | None,
    sampler: Callable[[str, int, float, int], SampleResult] = sample_certificate,
    sleeper: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> list[SampleResult]:
    results: list[SampleResult] = []
    deadline = clock() + overall_timeout if overall_timeout is not None else None

    for index in range(1, samples + 1):
        if deadline is not None:
            remaining = deadline - clock()
            if remaining <= 0:
                results.extend(
                    SampleResult(i, False, error="OverallTimeout")
                    for i in range(index, samples + 1)
                )
                break
            sample_timeout = min(timeout, remaining)
        else:
            sample_timeout = timeout

        results.append(sampler(host, port, sample_timeout, index))
        if index >= samples:
            continue

        sleep_for = interval
        if deadline is not None:
            remaining = deadline - clock()
            if remaining <= 0:
                continue
            sleep_for = min(interval, remaining)
        if sleep_for > 0:
            sleeper(sleep_for)

    return results


def evaluate_results(
    results: list[SampleResult],
    *,
    expected_serial: str | None,
    min_success: int,
    require_valid: bool,
    require_verified: bool,
) -> Evaluation:
    successful = [item for item in results if item.success]
    failures = len(results) - len(successful)
    if len(successful) < min_success:
        return Evaluation(
            "INSUFFICIENT_SAMPLES",
            2,
            len(successful),
            failures,
            min_success,
        )

    identities = {
        item.serial or f"SHA256:{item.fingerprint_sha256}"
        for item in successful
        if item.serial or item.fingerprint_sha256
    }
    if len(identities) != 1:
        return Evaluation(
            "MIXED_EDGE_CERTIFICATES",
            3,
            len(successful),
            failures,
            min_success,
        )

    observed = next(iter(identities), None)
    expected = normalize_serial(expected_serial)
    if expected and observed != expected:
        return Evaluation(
            "UNEXPECTED_CERTIFICATE",
            4,
            len(successful),
            failures,
            min_success,
            observed,
        )

    if require_valid and any(item.expired is not False for item in successful):
        return Evaluation(
            "CERTIFICATE_NOT_CURRENTLY_VALID",
            4,
            len(successful),
            failures,
            min_success,
            observed,
        )

    if require_verified and any(item.verification_ok is not True for item in successful):
        return Evaluation(
            "CERTIFICATE_VERIFICATION_FAILED",
            4,
            len(successful),
            failures,
            min_success,
            observed,
        )

    return Evaluation(
        "CONVERGED",
        0,
        len(successful),
        failures,
        min_success,
        observed,
    )


def print_sample(result: SampleResult) -> None:
    if not result.success:
        print(f"sample={result.index} result=error error={result.error or 'unknown'}")
        return
    expiration = "expired" if result.expired is True else "current" if result.expired is False else "unknown"
    verification = "verified" if result.verification_ok is True else "unverified"
    payload = {
        "sample": result.index,
        "result": "ok",
        "serial": result.serial,
        "fingerprint_sha256": result.fingerprint_sha256,
        "expiration": expiration,
        "not_after": result.not_after,
        "verification": verification,
        "verification_error": result.verification_error,
        "subject": result.subject,
    }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def nonnegative_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be zero or greater")
    return parsed


def positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sample and verify a public TLS endpoint across repeated connections.")
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=positive_int, default=DEFAULT_PORT)
    parser.add_argument("--samples", type=positive_int, default=DEFAULT_SAMPLES)
    parser.add_argument("--interval", type=nonnegative_float, default=DEFAULT_INTERVAL_SECONDS)
    parser.add_argument("--timeout", type=positive_float, default=DEFAULT_TIMEOUT_SECONDS, help="Per-sample connection timeout in seconds.")
    parser.add_argument("--overall-timeout", type=positive_float, help="Optional overall deadline in seconds.")
    parser.add_argument("--min-success", type=positive_int, help="Required successful samples; defaults to all requested samples.")
    parser.add_argument("--expected-serial")
    parser.add_argument("--require-valid", action="store_true", help="Fail if expiration cannot be proven current for every successful sample.")
    parser.add_argument("--require-verified", action="store_true", help="Fail unless hostname and CA-chain verification succeeds for every successful sample.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.port > 65535:
        print("port must be <= 65535", file=sys.stderr)
        return 2
    min_success = args.min_success or args.samples
    if min_success > args.samples:
        print("--min-success cannot exceed --samples", file=sys.stderr)
        return 2
    expected = normalize_serial(args.expected_serial)
    if args.expected_serial and (not expected or any(ch not in "0123456789ABCDEF" for ch in expected)):
        print("--expected-serial must contain hexadecimal digits (colons are allowed)", file=sys.stderr)
        return 2

    print(
        f"Sampling {args.host}:{args.port} {args.samples} time(s), "
        f"{args.interval:g}s apart; min_success={min_success} timeout={args.timeout:g}s"
    )
    results = collect_samples(
        host=args.host,
        port=args.port,
        samples=args.samples,
        interval=args.interval,
        timeout=args.timeout,
        overall_timeout=args.overall_timeout,
    )
    for result in results:
        print_sample(result)

    evaluation = evaluate_results(
        results,
        expected_serial=expected,
        min_success=min_success,
        require_valid=args.require_valid,
        require_verified=args.require_verified,
    )
    print(
        f"RESULT={evaluation.status} success={evaluation.success_count} "
        f"failed={evaluation.failure_count} required={evaluation.required_success}"
        + (f" identity={evaluation.observed_serial}" if evaluation.observed_serial else "")
    )
    return evaluation.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
