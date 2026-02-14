# Provider Management Schemas and Safe CRUD Playbook

## Placeholders
Use placeholders only:
- `<BASE_URL>` example: `http://127.0.0.1:8317`
- `<MANAGEMENT_KEY>`
- `<API_KEY>`

Never output real keys or hostnames unless explicitly provided by the user in the current task.

## Management auth headers
Use one of:
- `Authorization: Bearer <MANAGEMENT_KEY>`
- `X-Management-Key: <MANAGEMENT_KEY>`

## Safe CRUD playbook
1. Read current list with `GET`.
2. Backup current JSON/YAML snapshot.
3. Add by list replacement (`PUT`) or update a single entry (`PATCH`).
4. Re-read with `GET` and compare.

## Endpoint-specific schema

### 1) OpenAI compatibility providers

#### GET
- `GET /v0/management/openai-compatibility`

#### PUT (replace full list)
- `PUT /v0/management/openai-compatibility`
- Body supports either raw array or wrapped object:
```json
[
  {
    "name": "openrouter",
    "prefix": "team-a",
    "base-url": "https://openrouter.ai/api/v1",
    "api-key-entries": [
      { "api-key": "<PROVIDER_KEY>", "proxy-url": "" }
    ],
    "models": [
      { "name": "moonshotai/kimi-k2", "alias": "kimi-k2" }
    ],
    "headers": { "X-Custom": "value" }
  }
]
```

#### PATCH (update one entry)
- `PATCH /v0/management/openai-compatibility`
- Match target by `index` or `name`:
```json
{
  "name": "openrouter",
  "value": {
    "base-url": "https://openrouter.ai/api/v1",
    "prefix": "team-a",
    "models": [
      { "name": "openai/gpt-4.1", "alias": "gpt-4.1" }
    ]
  }
}
```

#### DELETE
- `DELETE /v0/management/openai-compatibility?name=<provider_name>`
- Or `?index=<n>`

### 2) Gemini key providers

#### GET
- `GET /v0/management/gemini-api-key`

#### PUT
- `PUT /v0/management/gemini-api-key`
- Body array item fields:
- `api-key`, `prefix`, `base-url`, `proxy-url`, `headers`, `excluded-models`

#### PATCH
- `PATCH /v0/management/gemini-api-key`
- Match target by `index` or `match` (existing `api-key` value):
```json
{
  "match": "<old_api_key>",
  "value": {
    "api-key": "<new_api_key>",
    "base-url": "https://generativelanguage.googleapis.com",
    "excluded-models": ["gemini-2.5-*"],
    "headers": {"X-Custom": "value"}
  }
}
```

#### DELETE
- `DELETE /v0/management/gemini-api-key?api-key=<exact_key>`
- Or `?index=<n>`

### 3) Claude key providers

#### GET
- `GET /v0/management/claude-api-key`

#### PUT
- `PUT /v0/management/claude-api-key`
- Body item fields:
- `api-key`, `prefix`, `base-url`, `proxy-url`, `models`, `headers`, `excluded-models`

#### PATCH
- `PATCH /v0/management/claude-api-key`
- Match by `index` or `match` (`api-key`):
```json
{
  "index": 0,
  "value": {
    "prefix": "team-a",
    "models": [{"name": "claude-sonnet-4", "alias": "sonnet"}]
  }
}
```

#### DELETE
- `DELETE /v0/management/claude-api-key?api-key=<exact_key>`
- Or `?index=<n>`

### 4) Codex key providers

#### GET
- `GET /v0/management/codex-api-key`

#### PUT
- `PUT /v0/management/codex-api-key`
- Body item fields:
- `api-key`, `prefix`, `base-url`, `proxy-url`, `models`, `headers`, `excluded-models`

#### PATCH
- `PATCH /v0/management/codex-api-key`
- Match by `index` or `match` (`api-key`):
```json
{
  "match": "<old_api_key>",
  "value": {
    "base-url": "https://api.openai.com/v1",
    "models": [{"name": "gpt-5-codex", "alias": "codex-latest"}]
  }
}
```

#### DELETE
- `DELETE /v0/management/codex-api-key?api-key=<exact_key>`
- Or `?index=<n>`

### 5) Vertex-compatible key providers

#### GET
- `GET /v0/management/vertex-api-key`

#### PUT
- `PUT /v0/management/vertex-api-key`
- Body item fields:
- `api-key`, `prefix`, `base-url`, `proxy-url`, `headers`, `models`

#### PATCH
- `PATCH /v0/management/vertex-api-key`
- Match by `index` or `match` (`api-key`):
```json
{
  "index": 0,
  "value": {
    "base-url": "https://example.com/api",
    "models": [{"name": "gemini-2.5-pro", "alias": "vertex-pro"}]
  }
}
```

#### DELETE
- `DELETE /v0/management/vertex-api-key?api-key=<exact_key>`
- Or `?index=<n>`

## Add-provider pattern (important)
There is no dedicated single-item `POST /provider` endpoint for these lists.
Use this pattern:
1. `GET` existing list.
2. Append new entry client-side.
3. `PUT` entire updated list.
4. `GET` verify.

## Minimal sanitized curl templates

### List providers
```bash
curl -sS -H "X-Management-Key: <MANAGEMENT_KEY>" \
  "<BASE_URL>/v0/management/openai-compatibility"
```

### Replace provider list
```bash
curl -sS -X PUT \
  -H "X-Management-Key: <MANAGEMENT_KEY>" \
  -H "Content-Type: application/json" \
  "<BASE_URL>/v0/management/openai-compatibility" \
  -d '[{"name":"openrouter","base-url":"https://openrouter.ai/api/v1","api-key-entries":[{"api-key":"<PROVIDER_KEY>"}],"models":[{"name":"moonshotai/kimi-k2","alias":"kimi-k2"}]}]'
```

### Patch one provider entry
```bash
curl -sS -X PATCH \
  -H "X-Management-Key: <MANAGEMENT_KEY>" \
  -H "Content-Type: application/json" \
  "<BASE_URL>/v0/management/openai-compatibility" \
  -d '{"name":"openrouter","value":{"prefix":"team-a"}}'
```

### Delete one provider entry
```bash
curl -sS -X DELETE \
  -H "X-Management-Key: <MANAGEMENT_KEY>" \
  "<BASE_URL>/v0/management/openai-compatibility?name=openrouter"
```
