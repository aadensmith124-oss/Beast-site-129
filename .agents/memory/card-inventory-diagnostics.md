---
name: Card inventory diagnostics
description: Conditions that make the authenticated cards catalog appear empty after a database restore or update.
---

The cards catalog depends on both schema compatibility and inventory state. A restored database may have the `cards` table but lack newer `card_bases` fields used by the API, while all imported cards may already be marked sold and assigned to users.

**Why:** The UI filters to unsold cards, and a missing selected column causes the authenticated API query to fail before the client can render its empty state.

**How to apply:** When cards appear empty, check `card_bases` columns and count `cards` by `is_sold` before changing application filters or resetting records. Add only missing schema fields safely; never mark sold cards available without confirming the data restore was intentional.