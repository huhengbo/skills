# MCP protocol compatibility

The portable Yunxiao doctor supports the current stateless MCP protocol and legacy 2025-era servers.

## Modern protocol first

For current MCP servers, the doctor probes `server/discover` using protocol version `2026-07-28`. Modern requests include the protocol version header, method/name headers when required, and client metadata in `_meta`. Modern connections do not send the legacy `initialize` / `notifications/initialized` handshake.

## Legacy fallback

If discovery clearly indicates an older server, the doctor falls back to a 2025-era initialize sequence, preserves the negotiated protocol version, sends `notifications/initialized`, and reuses a returned MCP session id for subsequent requests.

## Tool discovery

`tools/list` is paginated until the server stops returning a cursor. The doctor rejects repeated cursors and enforces a bounded page limit so malformed servers cannot create an unbounded loop.

## Streamable HTTP and SSE

Responses may be JSON or `text/event-stream`. SSE parsing joins all `data:` lines belonging to one event, ignores terminal `[DONE]` markers, and accepts only the JSON-RPC response whose `id` matches the pending request.

## Safety

Protocol negotiation never changes project data. Redirects remain disabled, request timeouts remain bounded, credentials are never printed, and malformed protocol responses fail closed.

The implementation is pure Node.js 18+ and has no shell dependency, so the same doctor entry point is used on Windows, macOS, and Linux.
