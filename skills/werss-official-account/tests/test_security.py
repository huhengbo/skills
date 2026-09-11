from __future__ import annotations

import importlib.util
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "werss.py"
spec = importlib.util.spec_from_file_location("werss", MODULE_PATH)
werss = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = werss
spec.loader.exec_module(werss)


class Server:
    def __init__(self, handler):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    @property
    def url(self):
        host, port = self.httpd.server_address
        return f"http://{host}:{port}"

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)


class QuietHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class TestSecurity(unittest.TestCase):
    def test_remote_http_is_rejected(self):
        with self.assertRaises(werss.WeRSSError):
            werss.validate_base_url("http://werss.example.com")

    def test_loopback_http_is_allowed(self):
        self.assertEqual(
            werss.validate_base_url("http://127.0.0.1:8001/"),
            "http://127.0.0.1:8001",
        )
        self.assertEqual(
            werss.validate_base_url("http://localhost:8001/base/"),
            "http://localhost:8001/base",
        )

    def test_embedded_credentials_query_fragment_and_control_chars_are_rejected(self):
        bad = [
            "https://user:pass@werss.example.com",
            "https://werss.example.com?token=secret",
            "https://werss.example.com#fragment",
            " https://werss.example.com",
            "https://werss.example.com\n",
        ]
        for value in bad:
            with self.subTest(value=value):
                with self.assertRaises(werss.WeRSSError):
                    werss.validate_base_url(value)

    def test_redirect_policy_blocks_credential_cross_origin_and_https_downgrade(self):
        self.assertFalse(
            werss.redirect_is_safe(
                "https://a.example.test/api",
                "https://b.example.test/next",
                True,
            )
        )
        self.assertTrue(
            werss.redirect_is_safe(
                "https://a.example.test/api",
                "https://a.example.test/next",
                True,
            )
        )
        self.assertFalse(
            werss.redirect_is_safe(
                "https://a.example.test/api",
                "http://a.example.test/next",
                False,
            )
        )

    def test_cross_origin_redirect_never_reaches_target_with_authorization(self):
        target_headers = []

        class TargetHandler(QuietHandler):
            def do_GET(self):
                target_headers.append(dict(self.headers))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b"{}")

        with Server(TargetHandler) as target:
            class SourceHandler(QuietHandler):
                def do_GET(self):
                    self.send_response(302)
                    self.send_header("Location", f"{target.url}/landing")
                    self.end_headers()

            with Server(SourceHandler) as source:
                config = werss.Config(source.url, "access-key", "secret-key", 2)
                with self.assertRaises(werss.WeRSSError):
                    werss.request_raw(config, werss.RequestSpec("GET", "/redirect"))

        self.assertEqual(target_headers, [])

    def test_http_error_body_and_configured_secrets_are_not_exposed(self):
        secret_body = b'{"access_key":"access-key","secret_key":"secret-key","token":"private"}'

        class ErrorHandler(QuietHandler):
            def do_GET(self):
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("X-Request-ID", "req-123")
                self.end_headers()
                self.wfile.write(secret_body)

        with Server(ErrorHandler) as server:
            config = werss.Config(server.url, "access-key", "secret-key", 2)
            with self.assertRaises(werss.WeRSSError) as raised:
                werss.request_raw(config, werss.RequestSpec("GET", "/fail"))

        message = str(raised.exception)
        self.assertIn("HTTP 500", message)
        self.assertIn("req-123", message)
        self.assertNotIn("access-key", message)
        self.assertNotIn("secret-key", message)
        self.assertNotIn("private", message)


if __name__ == "__main__":
    unittest.main()
