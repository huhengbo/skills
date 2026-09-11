from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "check_tls_certificate.py"
spec = importlib.util.spec_from_file_location("tlscheck", MODULE_PATH)
tlscheck = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = tlscheck
spec.loader.exec_module(tlscheck)


def ok(index, serial="ABCD", expired=False, verified=True):
    return tlscheck.SampleResult(
        index=index,
        success=True,
        serial=serial,
        fingerprint_sha256="00" * 32,
        expired=expired,
        verification_ok=verified,
    )


def fail(index):
    return tlscheck.SampleResult(index=index, success=False, error="TimeoutError")


class TestEvaluation(unittest.TestCase):
    def test_partial_failure_is_not_converged_by_default(self):
        evaluation = tlscheck.evaluate_results(
            [ok(1), fail(2)],
            expected_serial=None,
            min_success=2,
            require_valid=False,
            require_verified=False,
        )
        self.assertEqual(evaluation.status, "INSUFFICIENT_SAMPLES")
        self.assertNotEqual(evaluation.exit_code, 0)

    def test_mixed_serials_are_reported(self):
        evaluation = tlscheck.evaluate_results(
            [ok(1, "AAAA"), ok(2, "BBBB")],
            expected_serial=None,
            min_success=2,
            require_valid=False,
            require_verified=False,
        )
        self.assertEqual(evaluation.status, "MIXED_EDGE_CERTIFICATES")
        self.assertEqual(evaluation.exit_code, 3)

    def test_expected_serial_is_normalized(self):
        evaluation = tlscheck.evaluate_results(
            [ok(1, "ABCD")],
            expected_serial="ab:cd",
            min_success=1,
            require_valid=False,
            require_verified=False,
        )
        self.assertEqual(evaluation.status, "CONVERGED")

    def test_expiration_and_verification_are_separate_dimensions(self):
        expired = tlscheck.evaluate_results(
            [ok(1, expired=True, verified=True)],
            expected_serial=None,
            min_success=1,
            require_valid=True,
            require_verified=False,
        )
        self.assertEqual(expired.status, "CERTIFICATE_NOT_CURRENTLY_VALID")

        unverified = tlscheck.evaluate_results(
            [ok(1, expired=False, verified=False)],
            expected_serial=None,
            min_success=1,
            require_valid=False,
            require_verified=True,
        )
        self.assertEqual(unverified.status, "CERTIFICATE_VERIFICATION_FAILED")

    def test_interval_is_applied_between_samples(self):
        sleeps = []
        indexes = []

        def sampler(host, port, timeout, index):
            indexes.append(index)
            return ok(index)

        tlscheck.collect_samples(
            host="example.test",
            port=443,
            samples=3,
            interval=5,
            timeout=2,
            overall_timeout=None,
            sampler=sampler,
            sleeper=sleeps.append,
            clock=lambda: 0,
        )
        self.assertEqual(indexes, [1, 2, 3])
        self.assertEqual(sleeps, [5, 5])

    def test_overall_timeout_marks_remaining_samples_failed(self):
        times = iter([0, 0, 0.5, 1.0, 1.0])
        results = tlscheck.collect_samples(
            host="example.test",
            port=443,
            samples=3,
            interval=1,
            timeout=10,
            overall_timeout=1,
            sampler=lambda host, port, timeout, index: ok(index),
            sleeper=lambda seconds: None,
            clock=lambda: next(times),
        )
        self.assertEqual(len(results), 3)
        self.assertTrue(results[0].success)
        self.assertFalse(results[-1].success)


if __name__ == "__main__":
    unittest.main()
