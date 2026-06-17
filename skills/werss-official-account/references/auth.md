# Authentication

WeRSS / we-mp-rss supports Access Key API authentication:

```http
Authorization: AK-SK <access_key>:<secret_key>
```

Set credentials through environment variables:

```bash
export WERSS_BASE_URL="https://<your-werss-host>"
export WERSS_ACCESS_KEY="<access-key>"
export WERSS_SECRET_KEY="<secret-key>"
```

First-use flow:

1. Run `python scripts/werss.py doctor`.
2. If `WERSS_BASE_URL` is missing, set it to the WeRSS origin such as `https://werss.example.com`.
3. Open the WeRSS UI, log in, open Access Key management, create a dedicated key, and save the secret immediately because it may only be shown once.
4. Export `WERSS_ACCESS_KEY` and `WERSS_SECRET_KEY`.
5. Run `python scripts/werss.py doctor` again. Treat any reported auth/API error as a real configuration problem to fix.

Rules:

- Never commit real Access Keys, Secret Keys, passwords, cookies, or tokens.
- Store credentials in the user's shell, secret manager, CI secret store, or local untracked `.env`.
- Use a dedicated Access Key for agent workflows so it can be disabled or rotated independently.
- Keep WeRSS account username/password out of scripts. Use Access Key auth for API calls.
- `python scripts/werss.py doctor` checks both public API reachability and protected API auth when credentials are present.
- `python scripts/werss.py health` only checks the public OpenAPI document; protected operations still require Access Key variables.

Create Access Keys from the WeRSS UI: log in, open Access Key management, create a key, and save the secret immediately because it may only be shown once.
