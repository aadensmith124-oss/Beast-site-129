import assert from "node:assert/strict";
import test from "node:test";
import { formatOrdersAsText } from "./order-export";

test("formats all order details and delivered content as plain text", () => {
  const output = formatOrdersAsText([
    {
      id: 12,
      orderId: "abc123",
      createdAt: "2026-09-16T10:00:00.000Z",
      status: "delivering",
      paymentMethod: "Wallet",
      total: 1250,
      paidAmount: 1250,
      items: [{
        itemType: "product",
        quantity: 1,
        price: 1250,
        productName: "Premium Log",
        stockItem: { content: "login@example.com\npassword123" },
      }],
    },
  ]);

  assert.match(output, /Order ID: abc123/);
  assert.match(output, /Total: \$12\.50/);
  assert.match(output, /Premium Log/);
  assert.match(output, /login@example\.com/);
  assert.match(output, /password123/);
});

test("exports an empty order history without failing", () => {
  assert.match(formatOrdersAsText([]), /No orders found\./);
});