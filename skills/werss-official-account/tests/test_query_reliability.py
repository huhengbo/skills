from __future__ import annotations

import argparse
import importlib.util
import os
import sys
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "werss.py"
spec = importlib.util.spec_from_file_location("werss_query", MODULE_PATH)
werss = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = werss
spec.loader.exec_module(werss)


class TestArticleTimeFiltering(unittest.TestCase):
    def test_falls_back_to_later_publish_field_when_first_present_field_is_invalid(self):
        items = [
            {
                "id": "article-1",
                "publish_time": "not-a-time",
                "publishTime": "2030-01-02T00:00:00Z",
            }
        ]
        result = werss.filter_articles_since(items, "2029-01-01T00:00:00Z")
        self.assertEqual([item["id"] for item in result["items"]], ["article-1"])
        self.assertEqual(result["publish_time_fields_used"], {"publishTime": 1})

    def test_update_timestamp_is_not_used_as_publish_time(self):
        items = [
            {
                "id": "old-article-refreshed-today",
                "updated_at": "2030-01-02T00:00:00Z",
            }
        ]
        result = werss.filter_articles_since(items, "2029-01-01T00:00:00Z")
        self.assertEqual(result["items"], [])
        self.assertEqual(result["skipped_without_parseable_publish_time"], 1)


class TestArticlePagination(unittest.TestCase):
    def test_fetches_until_short_page_and_reports_complete_coverage(self):
        calls = []
        responses = [
            {"items": [
                {"id": "a", "publish_time": "2030-01-04T00:00:00Z"},
                {"id": "b", "publish_time": "2030-01-03T00:00:00Z"},
            ]},
            {"items": [
                {"id": "c", "publish_time": "2030-01-02T00:00:00Z"},
            ]},
        ]

        def requester(_config, spec):
            calls.append(spec.query)
            return responses[len(calls) - 1]

        result = werss.fetch_articles_for_window(
            werss.Config("https://werss.example.com", "ak", "sk", 1),
            {"offset": 4, "limit": 2, "search": "demo"},
            "2029-01-01T00:00:00Z",
            5,
            requester=requester,
        )

        self.assertEqual([query["offset"] for query in calls], [4, 6])
        self.assertEqual(result["pages_fetched"], 2)
        self.assertTrue(result["complete"])
        self.assertFalse(result["truncated"])
        self.assertEqual(result["returned_count"], 3)
        self.assertEqual(result["time_basis"], "publish_time_only")

    def test_reports_truncated_when_max_pages_are_exhausted(self):
        calls = []

        def requester(_config, spec):
            calls.append(spec.query)
            return {
                "items": [
                    {"id": f"{len(calls)}-a", "publish_time": "2030-01-04T00:00:00Z"},
                    {"id": f"{len(calls)}-b", "publish_time": "2030-01-03T00:00:00Z"},
                ]
            }

        result = werss.fetch_articles_for_window(
            werss.Config("https://werss.example.com", "ak", "sk", 1),
            {"offset": 0, "limit": 2},
            "2029-01-01T00:00:00Z",
            2,
            requester=requester,
        )

        self.assertEqual(len(calls), 2)
        self.assertFalse(result["complete"])
        self.assertTrue(result["truncated"])
        self.assertEqual(result["max_pages"], 2)


class TestDoctorExitCodes(unittest.TestCase):
    def test_missing_configuration_returns_nonzero_config_error(self):
        with patch.dict(os.environ, {}, clear=True), redirect_stdout(StringIO()):
            code = werss.cmd_doctor(argparse.Namespace())
        self.assertEqual(code, werss.DOCTOR_CONFIG_ERROR)

    def test_openapi_and_auth_failures_have_distinct_exit_codes(self):
        env = {
            "WERSS_BASE_URL": "https://werss.example.com",
            "WERSS_ACCESS_KEY": "ak",
            "WERSS_SECRET_KEY": "sk",
        }

        with patch.dict(os.environ, env, clear=True), patch.object(
            werss,
            "request_json",
            side_effect=werss.WeRSSError("openapi failed"),
        ), redirect_stdout(StringIO()):
            openapi_code = werss.cmd_doctor(argparse.Namespace())
        self.assertEqual(openapi_code, werss.DOCTOR_OPENAPI_ERROR)

        responses = [
            {"info": {"title": "WeRSS"}, "paths": {}},
            werss.WeRSSError("auth failed"),
        ]

        def request_json(_config, _spec):
            value = responses.pop(0)
            if isinstance(value, Exception):
                raise value
            return value

        with patch.dict(os.environ, env, clear=True), patch.object(
            werss,
            "request_json",
            side_effect=request_json,
        ), redirect_stdout(StringIO()):
            auth_code = werss.cmd_doctor(argparse.Namespace())
        self.assertEqual(auth_code, werss.DOCTOR_AUTH_ERROR)


if __name__ == "__main__":
    unittest.main()
