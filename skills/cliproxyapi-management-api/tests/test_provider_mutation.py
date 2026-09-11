from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "provider_mutation.py"
SPEC = importlib.util.spec_from_file_location("provider_mutation", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class ProviderMutationTests(unittest.TestCase):
    def test_remote_http_is_rejected_but_loopback_is_allowed(self):
        with self.assertRaisesRegex(MODULE.SafeMutationError, "HTTPS"):
            MODULE.validate_base_url("http://example.com:8317")
        self.assertEqual(MODULE.validate_base_url("http://127.0.0.1:8317"), "http://127.0.0.1:8317")

    def test_embedded_credentials_are_rejected(self):
        with self.assertRaisesRegex(MODULE.SafeMutationError, "credentials"):
            MODULE.validate_base_url("https://user:pass@example.com")

    def test_redaction_is_recursive(self):
        value = {
            "api-key": "secret-1",
            "nested": {"password": "secret-2", "name": "provider"},
            "items": [{"token": "secret-3"}],
        }
        redacted = MODULE.redact(value)
        rendered = json.dumps(redacted)
        self.assertNotIn("secret-1", rendered)
        self.assertNotIn("secret-2", rendered)
        self.assertNotIn("secret-3", rendered)
        self.assertEqual(redacted["nested"]["name"], "provider")

    def test_expected_hash_detects_concurrent_change(self):
        current = [{"name": "one"}]
        expected = MODULE.state_hash(current)
        self.assertEqual(MODULE.require_expected(current, expected), expected)
        with self.assertRaisesRegex(MODULE.SafeMutationError, "CONFLICT"):
            MODULE.require_expected([{"name": "changed"}], expected)

    def test_backup_contains_real_state_but_stdout_preview_can_be_redacted(self):
        state = [{"name": "p", "api-key": "real-secret"}]
        with tempfile.TemporaryDirectory() as directory:
            path = MODULE.write_backup(Path(directory), "openai-compatibility", state)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), state)
            self.assertNotIn("real-secret", json.dumps(MODULE.redact(state)))
            if os.name != "nt":
                self.assertEqual(path.stat().st_mode & 0o077, 0)

    def test_replace_rejects_stale_state_before_write(self):
        old = [{"name": "old"}]
        proposed = [{"name": "new"}]
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "new.json"
            input_path.write_text(json.dumps(proposed), encoding="utf-8")
            args = mock.Mock(
                confirm_replace=True,
                input=str(input_path),
                expected_sha256=MODULE.state_hash(old),
                backup_dir=directory,
                collection="openai-compatibility",
            )
            with mock.patch.dict(os.environ, {
                "CLIPROXYAPI_BASE_URL": "http://127.0.0.1:8317",
                "CLIPROXYAPI_MANAGEMENT_KEY": "management-secret",
            }, clear=True), mock.patch.object(MODULE, "request_json", return_value=[{"name": "concurrent"}]) as request_json:
                with self.assertRaisesRegex(MODULE.SafeMutationError, "CONFLICT"):
                    MODULE.cmd_replace(args)
                self.assertEqual(request_json.call_count, 1)

    def test_replace_verifies_post_write_state(self):
        old = [{"name": "old", "api-key": "secret"}]
        proposed = [{"name": "new", "api-key": "new-secret"}]
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "new.json"
            input_path.write_text(json.dumps(proposed), encoding="utf-8")
            args = mock.Mock(
                confirm_replace=True,
                input=str(input_path),
                expected_sha256=MODULE.state_hash(old),
                backup_dir=directory,
                collection="openai-compatibility",
            )
            with mock.patch.dict(os.environ, {
                "CLIPROXYAPI_BASE_URL": "http://localhost:8317",
                "CLIPROXYAPI_MANAGEMENT_KEY": "management-secret",
            }, clear=True), mock.patch.object(MODULE, "request_json", side_effect=[old, {"ok": True}, proposed]) as request_json:
                result = MODULE.cmd_replace(args)
                self.assertEqual(result["status"], "VERIFIED_SUCCESS")
                self.assertEqual(request_json.call_count, 3)
                self.assertNotIn("secret", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
