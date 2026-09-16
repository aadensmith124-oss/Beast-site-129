function formatDate(value: unknown): string {
  if (!value) return "Unknown";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString();
}

function formatMoney(cents: unknown): string {
  const amount = typeof cents === "number" ? cents : Number(cents ?? 0);
  return `$${(Number.isFinite(amount) ? amount / 100 : 0).toFixed(2)}`;
}

function appendMultiline(lines: string[], label: string, value: unknown) {
  if (value === null || value === undefined || String(value) === "") return;
  lines.push(`${label}:`);
  lines.push(...String(value).split(/\r?\n/).map((line) => `  ${line}`));
}

export function formatOrdersAsText(orders: any[]): string {
  const lines = [
    "TurtleCC.cc Order Export",
    `Generated: ${new Date().toISOString()}`,
    `Orders: ${orders.length}`,
    "",
  ];

  if (orders.length === 0) {
    lines.push("No orders found.");
    return `${lines.join("\n")}\n`;
  }

  orders.forEach((order, orderIndex) => {
    lines.push(`Order ${orderIndex + 1}`);
    lines.push(`Order ID: ${order.orderId ?? order.id ?? "Unknown"}`);
    lines.push(`Date: ${formatDate(order.createdAt)}`);
    lines.push(`Status: ${order.status ?? "Unknown"}`);
    lines.push(`Payment method: ${order.paymentMethod || "Unknown"}`);
    lines.push(`Total: ${formatMoney(order.total)}`);
    lines.push(`Paid: ${formatMoney(order.paidAmount)}`);
    if (order.paymentNote) lines.push(`Payment note: ${order.paymentNote}`);

    const items = Array.isArray(order.items) ? order.items : [];
    lines.push(`Items: ${items.length}`);
    let hasItemDelivery = false;

    items.forEach((item: any, itemIndex: number) => {
      const name = item.productName || item.variant?.name || item.itemType || "Item";
      lines.push(`  ${itemIndex + 1}. ${name}`);
      lines.push(`     Type: ${item.itemType || "product"}`);
      lines.push(`     Quantity: ${item.quantity ?? 1}`);
      lines.push(`     Price: ${formatMoney(item.price)}`);

      if (item.stockItem?.content) {
        hasItemDelivery = true;
        appendMultiline(lines, "     Delivered content", item.stockItem.content);
      }

      if (item.card) {
        hasItemDelivery = true;
        appendMultiline(
          lines,
          "     Card details",
          [
            `Number: ${item.card.cardNumber ?? ""}`,
            `Expiry: ${item.card.expiry ?? ""}`,
            `CVV: ${item.card.cvv ?? ""}`,
            `Country: ${item.card.country ?? ""}`,
            item.card.extras ? `Extras: ${item.card.extras}` : "",
          ].filter(Boolean).join("\n"),
        );
      }
    });

    if (order.deliveryContent && !hasItemDelivery) {
      appendMultiline(lines, "Delivery content", order.deliveryContent);
    }

    lines.push("", "-".repeat(60), "");
  });

  return `${lines.join("\n").trimEnd()}\n`;
}