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


class InstanceTest(unittest.TestCase):
    ENV = {"PVE_MAIN_BASE_URL": "https://a", "PVE_MAIN_API_TOKEN": "ta", "PVE_N100_BASE_URL": "https://b", "PVE_N100_API_TOKEN": "tb"}

    def test_list(self):
        self.assertEqual(pve_api.list_instances(self.ENV), ["main", "n100"])

    def test_named(self):
        self.assertEqual(pve_api.resolve_instance(self.ENV, "N100"), ("https://b", "tb"))

    def test_ambiguous_requires_name(self):
        with self.assertRaises(SystemExit) as ctx:
            pve_api.resolve_instance(self.ENV, "")
        self.assertIn("main, n100", str(ctx.exception))

    def test_single_instance_default(self):
        self.assertEqual(pve_api.resolve_instance({"PVE_MAIN_BASE_URL": "u", "PVE_MAIN_API_TOKEN": "t"}, ""), ("u", "t"))

    def test_unnamed_fallback(self):
        self.assertEqual(pve_api.resolve_instance({"PVE_BASE_URL": "u", "PVE_API_TOKEN": "t"}, ""), ("u", "t"))

    def test_unknown_name(self):
        with self.assertRaises(SystemExit):
            pve_api.resolve_instance(self.ENV, "nope")


class EnvFileTest(unittest.TestCase):
    def test_loads_unset_keys_only(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "pve.env"
            f.write_text("# c\nexport PVE_A_BASE_URL='https://a'\nexport PVE_A_API_TOKEN=\"t=1\"\nOTHER=x\n", encoding="utf-8")
            env = pve_api.load_env_file({"PVE_A_BASE_URL": "keep"}, str(f))
        self.assertEqual(env["PVE_A_BASE_URL"], "keep")
        self.assertEqual(env["PVE_A_API_TOKEN"], "t=1")
        self.assertNotIn("OTHER", env)

    def test_missing_file_is_ignored(self):
        self.assertEqual(pve_api.load_env_file({}, "/nonexistent/pve.env"), {})


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
