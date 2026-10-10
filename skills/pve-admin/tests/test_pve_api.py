import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import pve_api  # noqa: E402


class WriteGuardTest(unittest.TestCase):
    def test_mutations_need_yes(self):
        for method in ("POST", "PUT", "DELETE"):
            with self.assertRaises(SystemExit):
                pve_api.check_write_guard(method, False)
            pve_api.check_write_guard(method, True)

    def test_get_allowed(self):
        pve_api.check_write_guard("GET", False)

    def test_main_refuses_before_network(self):
        with self.assertRaises(SystemExit) as ctx:
            pve_api.main(["DELETE", "/nodes/pve/qemu/100"])
        self.assertIn("--yes", str(ctx.exception))


class UrlTest(unittest.TestCase):
    def test_default_prefix_and_query(self):
        self.assertEqual(
            pve_api.build_url("https://h:8006/", "nodes/n1/tasks", ["limit=5"]),
            "https://h:8006/api2/json/nodes/n1/tasks?limit=5",
        )

    def test_full_path_kept(self):
        self.assertEqual(pve_api.build_url("https://h:8006", "/api2/json/version", []), "https://h:8006/api2/json/version")


if __name__ == "__main__":
    unittest.main()
