# Safety Policy

The skill is for official-account research, subscription, refresh, RSS URL generation, and summarization.

## Allowed By Default

- Search official accounts.
- List subscribed accounts.
- Read account details.
- Subscribe to an account after the target is unambiguous.
- Enable or disable an account when the user asks.
- Refresh account articles.
- Search and read articles.
- Generate RSS / Atom / JSON feed URLs.
- List RSS feeds.
- List tags and create tags.

## Require Explicit Confirmation

- Subscribing when search results include multiple plausible accounts.
- Disabling an existing subscription.
- Refreshing a large page range.
- Creating tags with many accounts.

## Do Not Use By Default

- Delete accounts: `DELETE /api/v1/wx/mps/{mp_id}`.
- Delete articles: `DELETE /api/v1/wx/articles/{article_id}`.
- Clean invalid, old, or duplicate articles.
- Clear task queues or task history.
- Manage users, passwords, sessions, or Access Keys.
- Change system configuration.
- Trigger GitHub update endpoints.
- Operate cascade management endpoints.
- Use webhook/message-task mutation routes unless the user specifically asks for message automation.

When a user explicitly requests a destructive operation, state the exact endpoint, target ID, and expected impact before executing.
