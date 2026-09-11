#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ipaddress
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_LIMIT = 10
DEFAULT_OFFSET = 0
DEFAULT_START_PAGE = 0
DEFAULT_END_PAGE = 1
DEFAULT_RSS_FORMAT = "rss"
DEFAULT_TAG_LIMIT = 100
HOURS_PER_DAY = 24
TIMESTAMP_MS_THRESHOLD = 10_000_000_000
ALLOWED_RSS_FORMATS = {"rss", "atom", "json"}
STATUS_VALUES = {"active": 1, "inactive": 0}
TIME_FIELDS = (
    "publish_time",
    "publishTime",
    "create_time",
    "created_at",
    "updated_at",
    "updatedAt",
)
CONTROL_CHARACTER = re.compile(r"[\x00-\x1f\x7f]")


class WeRSSError(Exception):
    pass


@dataclass(frozen=True)
class Config:
    base_url: str
    access_key: str | None
    secret_key: str | None
    timeout: int


@dataclass(frozen=True)
class RequestSpec:
    method: str
    path: str
    query: dict[str, Any] | None = None
    body: dict[str, Any] | None = None
    auth: bool = True


@dataclass(frozen=True)
class RawResponse:
    status: int
    content_type: str
    text: str


@dataclass(frozen=True)
class FeedRequest:
    path: str
    feed_type: str
    fmt: str
    check: bool


def _origin(url: str) -> tuple[str, str, int | None]:
    parsed = urllib.parse.urlsplit(url)
    try:
        port = parsed.port
    except ValueError as exc:
        raise WeRSSError("WERSS_BASE_URL contains an invalid port.") from exc
    default_port = 443 if parsed.scheme == "https" else 80 if parsed.scheme == "http" else None
    return parsed.scheme.lower(), (parsed.hostname or "").lower(), port or default_port


def _is_loopback_host(hostname: str) -> bool:
    normalized = hostname.rstrip(".").lower()
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def validate_base_url(raw_value: str) -> str:
    if not raw_value:
        raise WeRSSError("Missing WERSS_BASE_URL.")
    if CONTROL_CHARACTER.search(raw_value) or raw_value != raw_value.strip():
        raise WeRSSError("WERSS_BASE_URL contains unsafe whitespace or control characters.")

    parsed = urllib.parse.urlsplit(raw_value)
    if parsed.scheme not in {"http", "https"}:
        raise WeRSSError("WERSS_BASE_URL must use http or https.")
    if not parsed.hostname:
        raise WeRSSError("WERSS_BASE_URL must include a hostname.")
    if parsed.username is not None or parsed.password is not None:
        raise WeRSSError("WERSS_BASE_URL must not contain embedded credentials.")
    if parsed.query or parsed.fragment:
        raise WeRSSError("WERSS_BASE_URL must not contain a query string or fragment.")
    try:
        parsed.port
    except ValueError as exc:
        raise WeRSSError("WERSS_BASE_URL contains an invalid port.") from exc
    if parsed.scheme == "http" and not _is_loopback_host(parsed.hostname):
        raise WeRSSError("Remote WeRSS instances must use HTTPS; HTTP is allowed only for loopback development.")

    path = parsed.path.rstrip("/")
    normalized = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))
    return normalized


def load_config(require_auth: bool) -> Config:
    base_url = validate_base_url(os.environ.get("WERSS_BASE_URL", ""))
    access_key = os.environ.get("WERSS_ACCESS_KEY", "").strip() or None
    secret_key = os.environ.get("WERSS_SECRET_KEY", "").strip() or None
    timeout_text = os.environ.get("WERSS_TIMEOUT", str(DEFAULT_TIMEOUT_SECONDS))
    try:
        timeout = int(timeout_text)
    except ValueError as exc:
        raise WeRSSError("WERSS_TIMEOUT must be an integer.") from exc
    if timeout <= 0:
        raise WeRSSError("WERSS_TIMEOUT must be greater than zero.")
    if require_auth and (not access_key or not secret_key):
        raise WeRSSError("Missing WERSS_ACCESS_KEY or WERSS_SECRET_KEY.")
    return Config(base_url, access_key, secret_key, timeout)


def clean_query(query: dict[str, Any] | None) -> dict[str, str]:
    cleaned: dict[str, str] = {}
    for key, value in (query or {}).items():
        if value is None or value == "":
            continue
        cleaned[key] = str(value).lower() if isinstance(value, bool) else str(value)
    return cleaned


def build_url(config: Config, spec: RequestSpec) -> str:
    url = f"{config.base_url}/{spec.path.lstrip('/')}"
    query = clean_query(spec.query)
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    return url


def redirect_is_safe(source_url: str, target_url: str, has_credentials: bool) -> bool:
    source = urllib.parse.urljoin(source_url, source_url)
    target = urllib.parse.urljoin(source_url, target_url)
    source_parts = urllib.parse.urlsplit(source)
    target_parts = urllib.parse.urlsplit(target)
    if source_parts.scheme == "https" and target_parts.scheme != "https":
        return False
    if has_credentials and _origin(source) != _origin(target):
        return False
    return True


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        has_credentials = req.get_header("Authorization") is not None
        target = urllib.parse.urljoin(req.full_url, newurl)
        if not redirect_is_safe(req.full_url, target, has_credentials):
            raise urllib.error.HTTPError(
                req.full_url,
                code,
                "unsafe redirect blocked",
                headers,
                fp,
            )
        return super().redirect_request(req, fp, code, msg, headers, target)


def _safe_http_error(exc: urllib.error.HTTPError, path: str) -> WeRSSError:
    request_id = None
    for header in ("x-request-id", "x-trace-id", "request-id"):
        value = exc.headers.get(header) if exc.headers else None
        if value and not CONTROL_CHARACTER.search(value):
            request_id = value[:128]
            break
    suffix = f" request_id={request_id}" if request_id else ""
    return WeRSSError(f"HTTP {exc.code} from {path}.{suffix}")


def request_raw(config: Config, spec: RequestSpec) -> RawResponse:
    headers = {"Accept": "application/json"}
    payload = None
    if spec.auth:
        if not config.access_key or not config.secret_key:
            raise WeRSSError("Missing WeRSS credentials for authenticated request.")
        headers["Authorization"] = f"AK-SK {config.access_key}:{config.secret_key}"
    if spec.body is not None:
        headers["Content-Type"] = "application/json"
        payload = json.dumps(spec.body, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(build_url(config, spec), data=payload, method=spec.method, headers=headers)
    opener = urllib.request.build_opener(SafeRedirectHandler())
    try:
        with opener.open(req, timeout=config.timeout) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            content_type = resp.headers.get("content-type", "")
            return RawResponse(resp.status, content_type, text)
    except urllib.error.HTTPError as exc:
        raise _safe_http_error(exc, spec.path) from exc
    except urllib.error.URLError as exc:
        reason_name = type(exc.reason).__name__ if exc.reason is not None else "URLError"
        raise WeRSSError(f"Request failed for {spec.path}: {reason_name}.") from exc


def request_json(config: Config, spec: RequestSpec) -> Any:
    raw = request_raw(config, spec)
    if "json" not in raw.content_type.lower():
        raise WeRSSError(f"Expected JSON from {spec.path}, got {raw.content_type or 'unknown content type'}.")
    try:
        return json.loads(raw.text)
    except json.JSONDecodeError as exc:
        raise WeRSSError(f"Invalid JSON returned from {spec.path}.") from exc


def print_json(data: Any) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True))


def quote_segment(value: str) -> str:
    return urllib.parse.quote(value, safe="")


def first_string(item: dict[str, Any], names: tuple[str, ...]) -> str | None:
    for name in names:
        value = item.get(name)
        if isinstance(value, str) and value:
            return value
    return None


def extract_items(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if not isinstance(data, dict):
        raise WeRSSError("Response is not a list or object.")
    for key in ("items", "data", "list", "records", "results"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            return extract_items(value)
    raise WeRSSError("Could not find an item list in the response.")


def parse_since(value: str) -> datetime:
    now = datetime.now(timezone.utc)
    if value.endswith("d") and value[:-1].isdigit():
        return now - timedelta(days=int(value[:-1]))
    if value.endswith("h") and value[:-1].isdigit():
        return now - timedelta(hours=int(value[:-1]))
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise WeRSSError("Use --since like 7d, 24h, or an ISO datetime.") from exc
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def parse_datetime_value(value: Any) -> datetime | None:
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > TIMESTAMP_MS_THRESHOLD else value
        return datetime.fromtimestamp(seconds, tz=timezone.utc)
    if not isinstance(value, str) or not value:
        return None
    normalized = value.replace("Z", "+00:00")
    for text in (normalized, normalized.replace(" ", "T")):
        try:
            parsed = datetime.fromisoformat(text)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def filter_since(data: Any, since: str | None) -> Any:
    if not since:
        return data
    threshold = parse_since(since)
    items = extract_items(data)
    kept: list[dict[str, Any]] = []
    skipped = 0
    for item in items:
        parsed = next((parse_datetime_value(item.get(field)) for field in TIME_FIELDS if item.get(field)), None)
        if parsed is None:
            skipped += 1
            continue
        if parsed >= threshold:
            kept.append(item)
    if not kept and skipped == len(items) and items:
        raise WeRSSError("No items had a parseable publish/create time for --since filtering.")
    return {"items": kept, "source_count": len(items), "skipped_without_parseable_time": skipped, "since": since}


def account_body_from_args(args: argparse.Namespace) -> dict[str, Any]:
    body = {"mp_name": args.name}
    for target, source in (("mp_id", "mp_id"), ("mp_cover", "cover"), ("avatar", "avatar"), ("mp_intro", "intro")):
        value = getattr(args, source, None)
        if value:
            body[target] = value
    return body


def account_body_from_item(item: dict[str, Any]) -> dict[str, Any]:
    name = first_string(item, ("mp_name", "name", "nickname", "title"))
    if not name:
        raise WeRSSError("Selected account candidate does not include a name.")
    body = {"mp_name": name}
    field_map = {
        "mp_id": ("mp_id", "id", "biz"),
        "mp_cover": ("mp_cover", "cover"),
        "avatar": ("avatar", "head_img"),
        "mp_intro": ("mp_intro", "intro", "description"),
    }
    for target, names in field_map.items():
        value = first_string(item, names)
        if value:
            body[target] = value
    return body


def cmd_health(args: argparse.Namespace) -> None:
    config = load_config(require_auth=False)
    data = request_json(config, RequestSpec("GET", "/api/openapi.json", auth=False))
    print_json({"base_url": config.base_url, "title": data.get("info", {}).get("title"), "paths": len(data.get("paths", {}))})


def cmd_doctor(args: argparse.Namespace) -> None:
    raw_base_url = os.environ.get("WERSS_BASE_URL", "")
    access_key = os.environ.get("WERSS_ACCESS_KEY", "").strip() or None
    secret_key = os.environ.get("WERSS_SECRET_KEY", "").strip() or None
    result = {"configured": {"base_url": bool(raw_base_url), "access_key": bool(access_key), "secret_key": bool(secret_key)}, "checks": [], "next_steps": []}
    if not raw_base_url:
        result["next_steps"].append("Set WERSS_BASE_URL to your WeRSS origin, for example https://werss.example.com.")
        result["next_steps"].append("Create a dedicated Access Key in the WeRSS UI, then export WERSS_ACCESS_KEY and WERSS_SECRET_KEY.")
        print_json(result)
        return
    try:
        base_url = validate_base_url(raw_base_url)
    except WeRSSError as exc:
        result["checks"].append({"name": "base_url", "ok": False, "error": str(exc)})
        print_json(result)
        return
    config = Config(base_url, access_key, secret_key, DEFAULT_TIMEOUT_SECONDS)
    try:
        data = request_json(config, RequestSpec("GET", "/api/openapi.json", auth=False))
        result["checks"].append({"name": "openapi", "ok": True, "title": data.get("info", {}).get("title"), "paths": len(data.get("paths", {}))})
    except WeRSSError as exc:
        result["checks"].append({"name": "openapi", "ok": False, "error": str(exc)})
    if not access_key or not secret_key:
        result["next_steps"].append("Open WeRSS Access Key management, create a key, and export WERSS_ACCESS_KEY and WERSS_SECRET_KEY.")
        print_json(result)
        return
    try:
        request_json(config, RequestSpec("GET", "/api/v1/wx/mps", {"limit": 1, "offset": 0}))
        result["checks"].append({"name": "access_key_auth", "ok": True})
    except WeRSSError as exc:
        result["checks"].append({"name": "access_key_auth", "ok": False, "error": str(exc)})
        result["next_steps"].append("Fix Access Key credentials or permissions, then rerun doctor.")
    print_json(result)


def cmd_search_accounts(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    path = f"/api/v1/wx/mps/search/{quote_segment(args.keyword)}"
    spec = RequestSpec("GET", path, {"limit": args.limit, "offset": args.offset})
    print_json(request_json(config, spec))


def cmd_list_accounts(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    status = STATUS_VALUES.get(args.status) if args.status else None
    query = {"limit": args.limit, "offset": args.offset, "kw": args.query, "status": status}
    print_json(request_json(config, RequestSpec("GET", "/api/v1/wx/mps", query)))


def cmd_get_account(args: argparse.Namespace) -> None:
    config = load_config(require_auth=False)
    path = f"/api/v1/wx/mps/{quote_segment(args.mp_id)}"
    print_json(request_json(config, RequestSpec("GET", path, auth=False)))


def cmd_account_from_article_url(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    spec = RequestSpec("POST", "/api/v1/wx/mps/by_article", {"url": args.url})
    print_json(request_json(config, spec))


def cmd_subscribe_account(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    if args.from_search:
        search_path = f"/api/v1/wx/mps/search/{quote_segment(args.from_search)}"
        data = request_json(config, RequestSpec("GET", search_path, {"limit": args.limit, "offset": DEFAULT_OFFSET}))
        items = extract_items(data)
        if len(items) != 1:
            raise WeRSSError(json.dumps({"message": "Search result is ambiguous.", "candidates": items}, ensure_ascii=False))
        body = account_body_from_item(items[0])
    else:
        if not args.name:
            raise WeRSSError("--name is required unless --from-search is used.")
        body = account_body_from_args(args)
    print_json(request_json(config, RequestSpec("POST", "/api/v1/wx/mps", body=body)))


def cmd_set_account_status(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    path = f"/api/v1/wx/mps/{quote_segment(args.mp_id)}"
    print_json(request_json(config, RequestSpec("PUT", path, body={"status": STATUS_VALUES[args.status]})))


def cmd_refresh_account(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    path = f"/api/v1/wx/mps/update/{quote_segment(args.mp_id)}"
    query = {"start_page": args.start_page, "end_page": args.end_page}
    print_json(request_json(config, RequestSpec("GET", path, query)))


def article_query(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "offset": args.offset,
        "limit": args.limit,
        "search": getattr(args, "keyword", ""),
        "mp_id": getattr(args, "mp_id", ""),
        "only_favorite": getattr(args, "only_favorite", None),
        "has_content": getattr(args, "has_content", None),
    }


def cmd_search_articles(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    data = request_json(config, RequestSpec("GET", "/api/v1/wx/articles", article_query(args)))
    print_json(filter_since(data, args.since))


def cmd_account_articles(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    data = request_json(config, RequestSpec("GET", "/api/v1/wx/articles", article_query(args)))
    print_json(filter_since(data, args.since))


def cmd_get_article(args: argparse.Namespace) -> None:
    config = load_config(require_auth=False)
    path = f"/api/v1/wx/articles/{quote_segment(args.article_id)}"
    print_json(request_json(config, RequestSpec("GET", path, {"content": args.content}, auth=False)))


def cmd_list_rss(args: argparse.Namespace) -> None:
    config = load_config(require_auth=False)
    query = {"limit": args.limit, "offset": args.offset, "is_update": args.is_update}
    raw = request_raw(config, RequestSpec("GET", "/rss", query, auth=False))
    print_json({"content_type": raw.content_type, "text": raw.text})


def feed_output(config: Config, feed: FeedRequest) -> dict[str, Any]:
    url = f"{config.base_url}{feed.path}"
    output = {"type": feed.feed_type, "format": feed.fmt, "url": url}
    if feed.check:
        raw = request_raw(config, RequestSpec("GET", feed.path, auth=False))
        output["check"] = {"status": raw.status, "content_type": raw.content_type, "bytes": len(raw.text.encode("utf-8"))}
    return output


def cmd_get_rss_url(args: argparse.Namespace) -> None:
    config = load_config(require_auth=False)
    path = f"/feed/{quote_segment(args.feed_id)}.{args.format}"
    print_json(feed_output(config, FeedRequest(path, "account_feed", args.format, args.check)))


def cmd_get_tag_rss_url(args: argparse.Namespace) -> None:
    config = load_config(require_auth=False)
    path = f"/feed/tag/{quote_segment(args.tag_id)}.{args.format}"
    print_json(feed_output(config, FeedRequest(path, "tag_feed", args.format, args.check)))


def cmd_get_search_rss_url(args: argparse.Namespace) -> None:
    config = load_config(require_auth=False)
    kw = quote_segment(args.keyword)
    path = f"/feed/search/{kw}/{quote_segment(args.feed_id)}.{args.format}"
    print_json(feed_output(config, FeedRequest(path, "search_feed", args.format, args.check)))


def cmd_list_tags(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    print_json(request_json(config, RequestSpec("GET", "/api/v1/wx/tags", {"offset": args.offset, "limit": args.limit})))


def cmd_create_tag(args: argparse.Namespace) -> None:
    config = load_config(require_auth=True)
    body = {"name": args.name, "mps_id": args.accounts, "status": STATUS_VALUES[args.status]}
    for field in ("cover", "intro"):
        value = getattr(args, field)
        if value:
            body[field] = value
    print_json(request_json(config, RequestSpec("POST", "/api/v1/wx/tags", body=body)))


def add_pagination(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--offset", type=int, default=DEFAULT_OFFSET)


def add_rss_format(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--format", choices=sorted(ALLOWED_RSS_FORMATS), default=DEFAULT_RSS_FORMAT)
    parser.add_argument("--check", action="store_true", help="Fetch the generated URL and report status metadata.")


def add_account_parsers(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("search-accounts")
    parser.add_argument("keyword")
    add_pagination(parser)
    parser.set_defaults(func=cmd_search_accounts)
    parser = sub.add_parser("list-accounts")
    parser.add_argument("--query", default="")
    parser.add_argument("--status", choices=sorted(STATUS_VALUES))
    add_pagination(parser)
    parser.set_defaults(func=cmd_list_accounts)
    parser = sub.add_parser("get-account")
    parser.add_argument("mp_id")
    parser.set_defaults(func=cmd_get_account)
    parser = sub.add_parser("account-from-article-url")
    parser.add_argument("url")
    parser.set_defaults(func=cmd_account_from_article_url)


def add_subscription_parsers(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("subscribe-account")
    parser.add_argument("--from-search")
    parser.add_argument("--mp-id")
    parser.add_argument("--name")
    parser.add_argument("--cover")
    parser.add_argument("--avatar")
    parser.add_argument("--intro")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.set_defaults(func=cmd_subscribe_account)
    parser = sub.add_parser("set-account-status")
    parser.add_argument("mp_id")
    parser.add_argument("--status", choices=sorted(STATUS_VALUES), required=True)
    parser.set_defaults(func=cmd_set_account_status)
    parser = sub.add_parser("refresh-account")
    parser.add_argument("mp_id")
    parser.add_argument("--start-page", type=int, default=DEFAULT_START_PAGE)
    parser.add_argument("--end-page", type=int, default=DEFAULT_END_PAGE)
    parser.set_defaults(func=cmd_refresh_account)


def add_article_parsers(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("search-articles")
    parser.add_argument("keyword")
    parser.add_argument("--since")
    parser.add_argument("--mp-id", default="")
    parser.add_argument("--only-favorite", action="store_true", default=None)
    parser.add_argument("--has-content", action="store_true", default=None)
    add_pagination(parser)
    parser.set_defaults(func=cmd_search_articles)
    parser = sub.add_parser("account-articles")
    parser.add_argument("mp_id")
    parser.add_argument("--since")
    parser.add_argument("--only-favorite", action="store_true", default=None)
    parser.add_argument("--has-content", action="store_true", default=None)
    add_pagination(parser)
    parser.set_defaults(func=cmd_account_articles)
    parser = sub.add_parser("get-article")
    parser.add_argument("article_id")
    parser.add_argument("--content", action="store_true")
    parser.set_defaults(func=cmd_get_article)


def add_rss_parsers(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("list-rss")
    parser.add_argument("--is-update", action="store_true")
    add_pagination(parser)
    parser.set_defaults(func=cmd_list_rss)
    parser = sub.add_parser("get-rss-url")
    parser.add_argument("feed_id")
    add_rss_format(parser)
    parser.set_defaults(func=cmd_get_rss_url)
    parser = sub.add_parser("get-tag-rss-url")
    parser.add_argument("tag_id")
    add_rss_format(parser)
    parser.set_defaults(func=cmd_get_tag_rss_url)
    parser = sub.add_parser("get-search-rss-url")
    parser.add_argument("keyword")
    parser.add_argument("feed_id")
    add_rss_format(parser)
    parser.set_defaults(func=cmd_get_search_rss_url)


def add_tag_parsers(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("list-tags")
    parser.add_argument("--limit", type=int, default=DEFAULT_TAG_LIMIT)
    parser.add_argument("--offset", type=int, default=DEFAULT_OFFSET)
    parser.set_defaults(func=cmd_list_tags)
    parser = sub.add_parser("create-tag")
    parser.add_argument("name")
    parser.add_argument("--accounts", required=True, help="Comma-separated account IDs expected by WeRSS.")
    parser.add_argument("--status", choices=sorted(STATUS_VALUES), default="active")
    parser.add_argument("--cover")
    parser.add_argument("--intro")
    parser.set_defaults(func=cmd_create_tag)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="WeRSS / we-mp-rss Access Key API helper.")
    sub = parser.add_subparsers(dest="command", required=True)
    doctor = sub.add_parser("doctor")
    doctor.set_defaults(func=cmd_doctor)
    health = sub.add_parser("health")
    health.set_defaults(func=cmd_health)
    add_account_parsers(sub)
    add_subscription_parsers(sub)
    add_article_parsers(sub)
    add_rss_parsers(sub)
    add_tag_parsers(sub)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except WeRSSError as exc:
        print(f"werss.py: error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
