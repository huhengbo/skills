# Authentication

WeRSS / we-mp-rss supports Access Key API authentication:

```http
Authorization: AK-SK <access_key>:<secret_key>
```

## Transport requirements

- Use HTTPS for remote WeRSS instances.
- Plain HTTP is accepted only for loopback development (`localhost`, `127.0.0.0/8`, or `::1`).
- `WERSS_BASE_URL` must not contain embedded credentials, query strings, fragments, control characters, or leading/trailing whitespace.
- Authenticated redirects are allowed only within the same origin. Cross-origin redirects are blocked before credentials can be forwarded.
- HTTPS-to-HTTP redirects are always blocked.
- HTTP error bodies are not echoed by the CLI because they may contain credentials or other sensitive values.

## Environment variables

Use environment variables rather than command-line arguments so credentials are not written into normal shell history.

### Windows PowerShell

```powershell
$env:WERSS_BASE_URL = "https://<your-werss-host>"
$env:WERSS_ACCESS_KEY = "<access-key>"
$env:WERSS_SECRET_KEY = "<secret-key>"
python scripts/werss.py doctor
```

### macOS / Linux

```bash
export WERSS_BASE_URL="https://<your-werss-host>"
export WERSS_ACCESS_KEY="<access-key>"
export WERSS_SECRET_KEY="<secret-key>"
python scripts/werss.py doctor
```

For a local development instance, `http://127.0.0.1:<port>` or `http://localhost:<port>` is permitted on all supported platforms.

## First-use flow

1. Run `python scripts/werss.py doctor`.
2. If `WERSS_BASE_URL` is missing, set it to the WeRSS origin such as `https://werss.example.com`.
3. Open the WeRSS UI, log in, open Access Key management, create a dedicated key, and save the secret immediately because it may only be shown once.
4. Set `WERSS_ACCESS_KEY` and `WERSS_SECRET_KEY` in the current environment or a supported secret store.
5. Run `python scripts/werss.py doctor` again. Treat any reported auth/API error as a real configuration problem to fix.

## Rules

- Never commit real Access Keys, Secret Keys, passwords, cookies, or tokens.
- Store credentials in the user's shell session, secret manager, CI secret store, or local untracked `.env`.
- Use a dedicated Access Key for agent workflows so it can be disabled or rotated independently.
- Keep WeRSS account username/password out of scripts. Use Access Key auth for API calls.
- `python scripts/werss.py doctor` checks both public API reachability and protected API auth when credentials are present.
- `python scripts/werss.py health` only checks the public OpenAPI document; protected operations still require Access Key variables.

Create Access Keys from the WeRSS UI: log in, open Access Key management, create a key, and save the secret immediately because it may only be shown once.
