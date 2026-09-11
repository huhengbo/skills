---
name: werss-official-account
description: Search, subscribe, retrieve, refresh, get RSS URLs for, and summarize WeChat Official Account content through a configured WeRSS / we-mp-rss instance using Access Key APIs. Use whenever the user asks about 公众号、微信公众号、订阅号、微信文章、微信推文、公众号账号搜索、订阅公众号、添加公众号、公众号 RSS、某公司/品牌/人物最近公众号动态、公众号周报/月报、公众号内容总结、公众号文章检索、公众号口径对比, or WeRSS feeds.
---

# WeRSS Official Account

## Overview

Use this skill to work with WeChat Official Account content stored in a WeRSS / we-mp-rss instance. Prefer the bundled Python CLI over ad hoc HTTP commands so authentication, query parameters, output shape, and safety rules stay consistent across Windows, macOS, and Linux.

## Setup

Start every first-time setup with:

```text
python scripts/werss.py doctor
```

The doctor command reports missing configuration, checks the WeRSS OpenAPI document when `WERSS_BASE_URL` is present, and verifies Access Key auth when credentials are present. It is automation-safe: `READY` exits with code `0`; configuration, OpenAPI/connectivity, and authentication failures use distinct non-zero exit codes.

Require `WERSS_BASE_URL`, `WERSS_ACCESS_KEY`, and `WERSS_SECRET_KEY` before calling protected WeRSS APIs. Read `references/auth.md` for native Windows PowerShell and macOS/Linux setup, HTTPS requirements, and credential handling. Use `python scripts/werss.py health` to verify only the public OpenAPI endpoint.

## Default Workflow

For prompts such as "查下理想汽车最近一周的公众号信息，总结一下":

1. Extract the entity, topic, and time range.
2. Search or list matching official accounts.
3. If no subscribed account is found, search public account candidates and ask before subscribing.
4. Refresh the selected account only when fresh content matters.
5. Search or list recent articles with `--since`; allow the CLI to scan bounded pages and inspect the returned coverage metadata.
6. If `truncated` is `true`, do not claim the requested time window is complete. Increase `--max-pages` deliberately or report the incomplete coverage.
7. Fetch full content for the most relevant items and summarize with article titles, account names, publish times, and source links.

Time-window filtering is based on publish/create time fields only. Refresh/update timestamps are never treated as publication time, so a newly refreshed old article is not silently classified as newly published.

## Account Commands

Use these for account discovery and subscription workflows:

```text
python scripts/werss.py search-accounts "理想汽车" --limit 10
python scripts/werss.py list-accounts --query "理想汽车" --status active
python scripts/werss.py get-account MP_ID
python scripts/werss.py account-from-article-url "https://mp.weixin.qq.com/..."
python scripts/werss.py subscribe-account --mp-id MP_ID --name "理想汽车"
python scripts/werss.py subscribe-account --from-search "理想汽车"
python scripts/werss.py set-account-status MP_ID --status active
python scripts/werss.py refresh-account MP_ID --start-page 0 --end-page 1
```

When `subscribe-account --from-search` returns multiple candidates, present them and ask the user to choose; do not guess.

## Article Commands

Use these for research and summarization:

```text
python scripts/werss.py search-articles "端到端智驾" --since 7d --limit 20
python scripts/werss.py account-articles MP_ID --since 7d --limit 30
python scripts/werss.py search-articles "端到端智驾" --since 30d --limit 50 --max-pages 20
python scripts/werss.py get-article ARTICLE_ID --content
```

When `--since` is supplied, the CLI scans pages up to `--max-pages` (default `20`) and reports `pages_fetched`, `complete`, `truncated`, counts, and the effective publication-time basis. A short final page proves the bounded query reached the end; exhausting `--max-pages` reports truncation instead of silently claiming completeness.

For broad public-web or news tasks, use this skill only when the user asks for WeChat Official Account / 公众号 sources. Combine with web search when the user explicitly asks for broader sources.

## RSS Commands

Use these when the user asks for RSS, Atom, JSON feed URLs, or subscriptions:

```text
python scripts/werss.py list-rss --limit 50
python scripts/werss.py get-rss-url FEED_ID --format rss
python scripts/werss.py get-rss-url FEED_ID --format atom --check
python scripts/werss.py get-tag-rss-url TAG_ID --format rss
python scripts/werss.py get-search-rss-url "理想汽车" FEED_ID --format rss
```

Default feed format is `rss`; supported formats are `rss`, `atom`, and `json`.

## Tag Commands

Use tags for grouped subscriptions:

```text
python scripts/werss.py list-tags
python scripts/werss.py create-tag "新能源车企" --accounts MP_ID1,MP_ID2
```

## Safety Rules

Default to read and low-risk write operations: search, list, subscribe, enable/disable account, refresh articles, get RSS URLs, fetch articles, and create tags. Do not delete accounts, delete articles, clean data, clear queues, manage users, reset passwords, manage Access Keys, alter system config, run GitHub update endpoints, or operate cascade management unless the user explicitly asks and confirms the exact destructive action.

Read `references/safety.md` before adding any new command or using a destructive WeRSS route.

## Resources

- `scripts/werss.py`: cross-platform Python CLI wrapper for WeRSS Access Key APIs.
- `references/api-map.md`: Supported command-to-endpoint mapping.
- `references/auth.md`: Access Key setup, transport safeguards, and Windows/macOS/Linux environment guidance.
- `references/safety.md`: Allowed and disallowed route policy.
