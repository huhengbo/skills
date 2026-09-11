# Safe provider mutations

Use `scripts/provider_mutation.py` for real provider-list mutations. Keep hand-written `curl` examples for explanation only.

## Configuration

Set the management origin and key through environment variables. Remote origins must use HTTPS; loopback HTTP is allowed for local development.

```text
CLIPROXYAPI_BASE_URL=https://<management-host>
CLIPROXYAPI_MANAGEMENT_KEY=<management-key>
```

The helper never prints the management key or provider keys.

## Snapshot and optimistic concurrency

Before a mutation, read the current collection and record its SHA-256 state hash:

```bash
python scripts/provider_mutation.py snapshot openai-compatibility
```

Use `--backup-dir <private-directory>` when a restorable snapshot is required. The backup contains the real provider state and must be treated as secret material. Normal command output contains a redacted preview only.

## Narrow update first

When the server supports PATCH, prepare the exact PATCH body and apply it only against the state hash that was reviewed:

```bash
python scripts/provider_mutation.py patch openai-compatibility \
  --input patch.json \
  --expected-sha256 <reviewed-state-sha256> \
  --backup-dir <private-directory> \
  --confirm-write
```

If the collection changed after review, the helper returns `CONFLICT` without issuing the write.

## Whole-list replacement

Use replacement only when the API requires it or when the user explicitly requested a full-list change:

```bash
python scripts/provider_mutation.py replace openai-compatibility \
  --input providers.json \
  --expected-sha256 <reviewed-state-sha256> \
  --backup-dir <private-directory> \
  --confirm-replace
```

The helper performs GET -> hash check -> private backup -> PUT -> GET verification. It never silently overwrites a changed remote collection.

## Safety boundaries

- Example generation is read-only; never infer execution from a request for an example.
- Do not place secret-bearing backups in the repository or normal log directories.
- Do not print backup content as part of normal output.
- Provider deletion is intentionally not implemented by the helper; use a separately reviewed exact-target workflow when deletion is explicitly requested.
- A failed or uncertain post-write verification is not permission to retry automatically.

The helper uses Python standard-library APIs only and is intended to run natively on Windows, macOS and Linux.
