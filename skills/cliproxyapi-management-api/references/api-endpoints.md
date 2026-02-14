# CLIProxyAPI Interface Catalog

## Table of Contents
- Core route activation and authentication
- Core API routes
- Management API routes (`/v0/management/*`)
- Amp module routes (`/api/*`, `/api/provider/*`, root aliases)
- Source references

## Core route activation and authentication
- Core API routes (`/v1/*`, `/v1beta/*`) use access auth middleware.
- Management routes (`/v0/management/*`) load only when a management secret exists.
- Management auth header supports either:
- `Authorization: Bearer <MANAGEMENT_KEY>`
- `X-Management-Key: <MANAGEMENT_KEY>`
- Amp routes are available only when Amp module is enabled and upstream proxy exists.

## Core API routes

### Public/basic
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | No | Service info and basic endpoint hints |
| GET | `/keep-alive` | No | Liveness/keepalive endpoint |
| GET | `/management.html` | No | Management panel asset |

### OpenAI-compatible (`/v1`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/models` | API key | Unified model list |
| POST | `/v1/chat/completions` | API key | OpenAI chat completions |
| POST | `/v1/completions` | API key | OpenAI completions |
| POST | `/v1/messages` | API key | Claude-compatible messages |
| POST | `/v1/messages/count_tokens` | API key | Claude token counting |
| POST | `/v1/responses` | API key | OpenAI Responses API |
| POST | `/v1/responses/compact` | API key | Compact response mode |

### Gemini-compatible (`/v1beta`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1beta/models` | API key | Gemini model list |
| POST | `/v1beta/models/*action` | API key | Gemini model actions |
| GET | `/v1beta/models/*action` | API key | Gemini action read endpoints |

### Internal and callback routes
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/v1internal:method` | No | Gemini CLI internal bridge route |
| GET | `/anthropic/callback` | No | OAuth callback landing |
| GET | `/codex/callback` | No | OAuth callback landing |
| GET | `/google/callback` | No | OAuth callback landing |
| GET | `/iflow/callback` | No | OAuth callback landing |
| GET | `/antigravity/callback` | No | OAuth callback landing |

### WebSocket route
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/ws` (default, configurable) | Conditional | Auth required only when `ws-auth=true` |

## Management API routes (`/v0/management/*`)

### Usage and config file
| Method | Path | Notes |
|---|---|---|
| GET | `/usage` | Usage statistics |
| GET | `/usage/export` | Export usage |
| POST | `/usage/import` | Import usage |
| GET | `/config` | Read normalized runtime config |
| GET | `/config.yaml` | Read raw YAML |
| PUT | `/config.yaml` | Replace YAML config |
| GET | `/latest-version` | Query latest version info |

### Runtime toggles and numeric settings
| Method | Path | Notes |
|---|---|---|
| GET | `/debug` | Read debug flag |
| PUT | `/debug` | Set debug flag |
| PATCH | `/debug` | Patch debug flag |
| GET | `/logging-to-file` | Read file logging flag |
| PUT | `/logging-to-file` | Set file logging flag |
| PATCH | `/logging-to-file` | Patch file logging flag |
| GET | `/logs-max-total-size-mb` | Read total log size cap |
| PUT | `/logs-max-total-size-mb` | Set total log size cap |
| PATCH | `/logs-max-total-size-mb` | Patch total log size cap |
| GET | `/error-logs-max-files` | Read error log retention |
| PUT | `/error-logs-max-files` | Set error log retention |
| PATCH | `/error-logs-max-files` | Patch error log retention |
| GET | `/usage-statistics-enabled` | Read usage statistics flag |
| PUT | `/usage-statistics-enabled` | Set usage statistics flag |
| PATCH | `/usage-statistics-enabled` | Patch usage statistics flag |
| GET | `/request-retry` | Read retry count |
| PUT | `/request-retry` | Set retry count |
| PATCH | `/request-retry` | Patch retry count |
| GET | `/max-retry-interval` | Read max retry interval |
| PUT | `/max-retry-interval` | Set max retry interval |
| PATCH | `/max-retry-interval` | Patch max retry interval |
| GET | `/force-model-prefix` | Read model prefix policy |
| PUT | `/force-model-prefix` | Set model prefix policy |
| PATCH | `/force-model-prefix` | Patch model prefix policy |
| GET | `/routing/strategy` | Read routing strategy |
| PUT | `/routing/strategy` | Set routing strategy |
| PATCH | `/routing/strategy` | Patch routing strategy |
| GET | `/ws-auth` | Read websocket auth flag |
| PUT | `/ws-auth` | Set websocket auth flag |
| PATCH | `/ws-auth` | Patch websocket auth flag |

### Proxy and generic API passthrough
| Method | Path | Notes |
|---|---|---|
| GET | `/proxy-url` | Read global proxy URL |
| PUT | `/proxy-url` | Set global proxy URL |
| PATCH | `/proxy-url` | Patch global proxy URL |
| DELETE | `/proxy-url` | Delete global proxy URL |
| POST | `/api-call` | Generic outbound API call tool |

### Quota behavior
| Method | Path | Notes |
|---|---|---|
| GET | `/quota-exceeded/switch-project` | Read quota fallback behavior |
| PUT | `/quota-exceeded/switch-project` | Set quota fallback behavior |
| PATCH | `/quota-exceeded/switch-project` | Patch quota fallback behavior |
| GET | `/quota-exceeded/switch-preview-model` | Read preview fallback behavior |
| PUT | `/quota-exceeded/switch-preview-model` | Set preview fallback behavior |
| PATCH | `/quota-exceeded/switch-preview-model` | Patch preview fallback behavior |

### Top-level access keys
| Method | Path | Notes |
|---|---|---|
| GET | `/api-keys` | List client API keys |
| PUT | `/api-keys` | Replace client API keys |
| PATCH | `/api-keys` | Patch client API keys |
| DELETE | `/api-keys` | Delete client API keys |

### Provider credential/config endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/gemini-api-key` | List Gemini credentials |
| PUT | `/gemini-api-key` | Replace Gemini credentials |
| PATCH | `/gemini-api-key` | Patch one Gemini credential |
| DELETE | `/gemini-api-key` | Delete Gemini credential |
| GET | `/claude-api-key` | List Claude credentials |
| PUT | `/claude-api-key` | Replace Claude credentials |
| PATCH | `/claude-api-key` | Patch one Claude credential |
| DELETE | `/claude-api-key` | Delete Claude credential |
| GET | `/codex-api-key` | List Codex credentials |
| PUT | `/codex-api-key` | Replace Codex credentials |
| PATCH | `/codex-api-key` | Patch one Codex credential |
| DELETE | `/codex-api-key` | Delete Codex credential |
| GET | `/openai-compatibility` | List OpenAI-compatible providers |
| PUT | `/openai-compatibility` | Replace provider list |
| PATCH | `/openai-compatibility` | Patch one provider entry |
| DELETE | `/openai-compatibility` | Delete one provider entry |
| GET | `/vertex-api-key` | List Vertex-compatible credentials |
| PUT | `/vertex-api-key` | Replace Vertex-compatible credentials |
| PATCH | `/vertex-api-key` | Patch one Vertex-compatible credential |
| DELETE | `/vertex-api-key` | Delete one Vertex-compatible credential |

### OAuth model controls
| Method | Path | Notes |
|---|---|---|
| GET | `/oauth-excluded-models` | Read provider-level model exclusions |
| PUT | `/oauth-excluded-models` | Replace exclusions map |
| PATCH | `/oauth-excluded-models` | Patch exclusions |
| DELETE | `/oauth-excluded-models` | Delete exclusions item/channel |
| GET | `/oauth-model-alias` | Read OAuth model alias map |
| PUT | `/oauth-model-alias` | Replace alias map |
| PATCH | `/oauth-model-alias` | Patch alias entries |
| DELETE | `/oauth-model-alias` | Delete alias entries/channel |

### Logs and request logs
| Method | Path | Notes |
|---|---|---|
| GET | `/logs` | Read logs |
| DELETE | `/logs` | Delete logs |
| GET | `/request-error-logs` | List request error logs |
| GET | `/request-error-logs/:name` | Download specific error log |
| GET | `/request-log-by-id/:id` | Query request log by ID |
| GET | `/request-log` | Read request log flag/config |
| PUT | `/request-log` | Set request log flag/config |
| PATCH | `/request-log` | Patch request log flag/config |

### Amp integration config
| Method | Path | Notes |
|---|---|---|
| GET | `/ampcode` | Read full Amp config |
| GET | `/ampcode/upstream-url` | Read Amp upstream URL |
| PUT | `/ampcode/upstream-url` | Set Amp upstream URL |
| PATCH | `/ampcode/upstream-url` | Patch Amp upstream URL |
| DELETE | `/ampcode/upstream-url` | Delete Amp upstream URL |
| GET | `/ampcode/upstream-api-key` | Read Amp upstream API key |
| PUT | `/ampcode/upstream-api-key` | Set Amp upstream API key |
| PATCH | `/ampcode/upstream-api-key` | Patch Amp upstream API key |
| DELETE | `/ampcode/upstream-api-key` | Delete Amp upstream API key |
| GET | `/ampcode/restrict-management-to-localhost` | Read Amp localhost restriction |
| PUT | `/ampcode/restrict-management-to-localhost` | Set Amp localhost restriction |
| PATCH | `/ampcode/restrict-management-to-localhost` | Patch Amp localhost restriction |
| GET | `/ampcode/model-mappings` | Read Amp model mappings |
| PUT | `/ampcode/model-mappings` | Replace Amp model mappings |
| PATCH | `/ampcode/model-mappings` | Patch Amp model mappings |
| DELETE | `/ampcode/model-mappings` | Delete Amp model mappings |
| GET | `/ampcode/force-model-mappings` | Read mapping priority mode |
| PUT | `/ampcode/force-model-mappings` | Set mapping priority mode |
| PATCH | `/ampcode/force-model-mappings` | Patch mapping priority mode |
| GET | `/ampcode/upstream-api-keys` | Read per-client Amp upstream key map |
| PUT | `/ampcode/upstream-api-keys` | Replace per-client Amp upstream key map |
| PATCH | `/ampcode/upstream-api-keys` | Patch per-client Amp upstream key map |
| DELETE | `/ampcode/upstream-api-keys` | Delete per-client Amp upstream key map |

### Auth file and OAuth session operations
| Method | Path | Notes |
|---|---|---|
| GET | `/auth-files` | List auth files |
| GET | `/auth-files/models` | List model availability from auth files |
| GET | `/model-definitions/:channel` | Read static model definitions by channel |
| GET | `/auth-files/download` | Download auth file |
| POST | `/auth-files` | Upload auth file |
| DELETE | `/auth-files` | Delete auth file |
| PATCH | `/auth-files/status` | Patch auth file active status |
| POST | `/vertex/import` | Import Vertex credentials |
| GET | `/anthropic-auth-url` | Start Anthropic OAuth flow |
| GET | `/codex-auth-url` | Start Codex OAuth flow |
| GET | `/gemini-cli-auth-url` | Start Gemini CLI OAuth flow |
| GET | `/antigravity-auth-url` | Start Antigravity OAuth flow |
| GET | `/qwen-auth-url` | Start Qwen OAuth flow |
| GET | `/kimi-auth-url` | Start Kimi OAuth flow |
| GET | `/iflow-auth-url` | Start iFlow OAuth flow |
| POST | `/iflow-auth-url` | Start iFlow cookie-based auth flow |
| POST | `/oauth-callback` | Submit OAuth callback data |
| GET | `/get-auth-status` | Poll auth status |

## Amp module routes (`/api/*`, `/api/provider/*`, root aliases)

### Amp upstream management proxy (`/api/*`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| ANY | `/api/internal` | API key | Upstream passthrough |
| ANY | `/api/internal/*path` | API key | Upstream passthrough |
| ANY | `/api/user` | API key | Upstream passthrough |
| ANY | `/api/user/*path` | API key | Upstream passthrough |
| ANY | `/api/auth` | API key | Upstream passthrough |
| ANY | `/api/auth/*path` | API key | Upstream passthrough |
| ANY | `/api/meta` | API key | Upstream passthrough |
| ANY | `/api/meta/*path` | API key | Upstream passthrough |
| ANY | `/api/ads` | API key | Upstream passthrough |
| ANY | `/api/telemetry` | API key | Upstream passthrough |
| ANY | `/api/telemetry/*path` | API key | Upstream passthrough |
| ANY | `/api/threads` | API key | Upstream passthrough |
| ANY | `/api/threads/*path` | API key | Upstream passthrough |
| ANY | `/api/otel` | API key | Upstream passthrough |
| ANY | `/api/otel/*path` | API key | Upstream passthrough |
| ANY | `/api/tab` | API key | Upstream passthrough |
| ANY | `/api/tab/*path` | API key | Upstream passthrough |
| ANY | `/api/provider/google/v1beta1/*path` | API key | Gemini bridge + fallback for POST model actions |

### Root aliases for Amp CLI flows
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/threads` | API key/bypass rules | Amp root alias |
| GET | `/threads/*path` | API key/bypass rules | Amp root alias |
| GET | `/docs` | API key/bypass rules | Amp root alias |
| GET | `/docs/*path` | API key/bypass rules | Amp root alias |
| GET | `/settings` | API key/bypass rules | Amp root alias |
| GET | `/settings/*path` | API key/bypass rules | Amp root alias |
| GET | `/threads.rss` | API key/bypass rules | Amp root alias |
| GET | `/news.rss` | API key/bypass rules | Amp root alias |
| ANY | `/auth` | API key/bypass rules | Amp root auth alias |
| ANY | `/auth/*path` | API key/bypass rules | Amp root auth alias |

### Provider aliases (`/api/provider/:provider/*`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/provider/:provider/models` | API key | Provider-specific model list |
| POST | `/api/provider/:provider/chat/completions` | API key | OpenAI-compatible, fallback-enabled |
| POST | `/api/provider/:provider/completions` | API key | OpenAI-compatible, fallback-enabled |
| POST | `/api/provider/:provider/responses` | API key | OpenAI Responses, fallback-enabled |
| GET | `/api/provider/:provider/v1/models` | API key | Provider-specific model list |
| POST | `/api/provider/:provider/v1/chat/completions` | API key | OpenAI-compatible, fallback-enabled |
| POST | `/api/provider/:provider/v1/completions` | API key | OpenAI-compatible, fallback-enabled |
| POST | `/api/provider/:provider/v1/responses` | API key | OpenAI Responses, fallback-enabled |
| POST | `/api/provider/:provider/v1/messages` | API key | Claude-compatible, fallback-enabled |
| POST | `/api/provider/:provider/v1/messages/count_tokens` | API key | Claude token count, fallback-enabled |
| GET | `/api/provider/:provider/v1beta/models` | API key | Gemini model list |
| POST | `/api/provider/:provider/v1beta/models/*action` | API key | Gemini action, fallback-enabled |
| GET | `/api/provider/:provider/v1beta/models/*action` | API key | Gemini action read |

## Source references
- `internal/api/server.go`
- `internal/api/handlers/management/`
- `internal/api/modules/amp/routes.go`
