---
name: Crypto payment settlement
description: Rules for safely confirming and crediting blockchain-backed payments.
---

Blockchain payment providers can deliver the same confirmation through a webhook, a polling worker, and a client status request. Settlement must be idempotent, authenticated, and retryable if a payment reaches completed status before its balance or order update finishes.

**Why:** Payment confirmation is a retry-prone distributed workflow; marking a payment complete before its business-side credit can otherwise lose funds, while processing callbacks independently can double-credit.

**How to apply:** Keep signed webhook verification and provider polling as complementary paths, lock the payment row while settling, record a payment-specific settlement marker, and include completed-but-unsettled rows in retry scans.