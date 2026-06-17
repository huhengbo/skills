# API Map

Use `scripts/werss.py` instead of hand-written HTTP calls. This map documents the supported command surface.

## Accounts

| Command | WeRSS endpoint |
| --- | --- |
| `search-accounts` | `GET /api/v1/wx/mps/search/{kw}` |
| `list-accounts` | `GET /api/v1/wx/mps` |
| `get-account` | `GET /api/v1/wx/mps/{mp_id}` |
| `account-from-article-url` | `POST /api/v1/wx/mps/by_article?url=...` |
| `subscribe-account` | `POST /api/v1/wx/mps` |
| `set-account-status` | `PUT /api/v1/wx/mps/{mp_id}` |
| `refresh-account` | `GET /api/v1/wx/mps/update/{mp_id}` |

## Articles

| Command | WeRSS endpoint |
| --- | --- |
| `search-articles` | `GET /api/v1/wx/articles?search=...` |
| `account-articles` | `GET /api/v1/wx/articles?mp_id=...` |
| `get-article` | `GET /api/v1/wx/articles/{article_id}` |

## RSS

| Command | WeRSS endpoint |
| --- | --- |
| `list-rss` | `GET /rss` |
| `get-rss-url` | Builds `/feed/{feed_id}.{ext}` |
| `get-tag-rss-url` | Builds `/feed/tag/{tag_id}.{ext}` |
| `get-search-rss-url` | Builds `/feed/search/{kw}/{feed_id}.{ext}` |

## Tags

| Command | WeRSS endpoint |
| --- | --- |
| `list-tags` | `GET /api/v1/wx/tags` |
| `create-tag` | `POST /api/v1/wx/tags` |

## Notes

- Protected `/api/v1/wx/*` endpoints require Access Key authentication.
- Public RSS endpoints can be read without Access Key, but the CLI still uses the configured base URL.
- The OpenAPI document is available at `/api/openapi.json`.
