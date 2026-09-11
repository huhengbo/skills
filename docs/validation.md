# Repository validation

Run the same repository-wide validation locally on Windows, macOS, or Linux:

```text
python scripts/validate_repo.py --with-tests
```

The command performs:

- skill directory / `SKILL.md` frontmatter checks;
- referenced local resource existence checks;
- `skills-manifest.json`, marketplace, and per-skill plugin metadata consistency checks;
- local-secret/private-key hygiene checks without printing matched secret values;
- required `.gitignore` policy checks;
- automatic discovery and execution of Python `test_*.py` suites;
- automatic discovery and execution of Node `*.test.mjs` suites.

GitHub Actions runs exactly this command on `windows-latest`, `macos-latest`, and `ubuntu-latest`.

The canonical workflow does not require Bash, WSL, GNU utilities, or shell-specific glob expansion.
