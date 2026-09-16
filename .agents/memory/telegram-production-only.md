---
name: Telegram polling runtime
description: Telegram polling can run in development, but only one process may poll a bot token.
---

The Telegram bot must poll only from the published production server. Preview/dev polling is disabled because it competes with production for the same Telegram token; Vercel serverless requests do not start polling.

**Why:** Telegram long polling allows only one active consumer per bot token, and simultaneous Preview/production processes produce a 409 `getUpdates` conflict.

**How to apply:** Keep Preview polling disabled, republish/restart production after bot changes, and never start a standalone bot worker while the published server is polling the same token.