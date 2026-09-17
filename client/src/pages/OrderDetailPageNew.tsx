import { useRoute, useLocation } from "wouter";
import { useOrders } from "@/hooks/use-orders";
import { Loader2, ChevronLeft, ChevronDown, ChevronUp, Copy, Check, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateTime } from "@/lib/date-utils";

function statusLabel(s: string) {
  if (s === "pending") return "pending";
  if (s === "waiting_payment") return "unpaid";
  if (s === "delivering") return "delivered";
  if (s === "fulfilled") return "delivered";
  if (s === "refunded") return "refunded";
  if (s === "replaced") return "replaced";
  return s;
}

function statusColor(s: string) {
  if (s === "fulfilled" || s === "delivering") return "text-red-400";
  if (s === "replaced") return "text-blue-400";
  if (s === "waiting_payment") return "text-orange-400";
  if (s === "refunded") return "text-orange-400";
  return "text-white/45";
}

function parseDeliveryMap(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>;
  } catch {}
  return null;
}

export default function OrderDetailPageNew() {
  const [, params] = useRoute("/order/:id");
  const [, setLocation] = useLocation();
  const { data: orders } = useOrders();
  const [activeTab, setActiveTab] = useState<"info" | "products">("info");
  const [stockVisible, setStockVisible] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [liveCheckResult, setLiveCheckResult] = useState<{ live: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const liveCheckMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/live-check`, {});
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      setLiveCheckResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (e: Error) => {
      toast({ title: "Live Check Failed", description: e.message, variant: "destructive" });
    },
  });

  const order = orders?.find((o: any) => o.orderId === params?.id || o.id.toString() === params?.id);

  if (!orders) {
    return <div className="flex h-screen items-center justify-center bg-[#0d0d0d]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-white font-bold">Order not found</p>
        <button onClick={() => setLocation("/orders")} className="text-sm text-primary hover:underline">← Back to Orders</button>
      </div>
    );
  }

  const paid = (order.status === "fulfilled" || order.status === "delivering" || order.status === "replaced") ? order.total : 0;
  const expected = order.total;

  const allItems = order.items || [];
  const grouped: { key: string; productName: string; variantName: string; qty: number; unitPrice: number; itemType: string; cardContent?: string }[] = [];
  const seen: Record<string, number> = {};
  for (const item of allItems) {
    const isCard = item.itemType === "card";
    const isAchItem = item.itemType === "ach";
    const key = isCard ? `card-${item.cardId ?? item.id}` : isAchItem ? `ach-${item.id}` : String(item.variantId || item.id);
    if (seen[key] === undefined) {
      seen[key] = grouped.length;
      grouped.push({
        key,
        productName: isCard
          ? (item.card?.maskedCard ? `Card ${item.card.maskedCard}` : "Card")
          : isAchItem
          ? "ACH Account"
          : (item.productName || "Product"),
        variantName: isCard
          ? (item.card?.country ?? "—")
          : isAchItem
          ? "Bank Account"
          : (item.variant?.name || item.variantName || "—"),
        qty: item.quantity ?? 1,
        unitPrice: item.price,
        itemType: item.itemType ?? "product",
        cardContent: isCard && item.card
          ? [item.card.cardNumber, item.card.expiry, item.card.cvv, item.card.country, item.card.extras].filter(Boolean).join("|")
          : undefined,
      });
    } else {
      grouped[seen[key]].qty += item.quantity ?? 1;
    }
  }

  const deliveryMap = parseDeliveryMap(order.deliveryContent);
  const isFulfilled = order.status === "fulfilled" || order.status === "delivering" || order.status === "replaced";

  const getStockForKey = (item: typeof grouped[0]): string | null => {
    if (!isFulfilled) return null;
    if (item.itemType === "card") return item.cardContent || null;
    if (item.itemType === "ach") return order.deliveryContent || null;
    if (deliveryMap) return deliveryMap[item.key] || null;
    return order.deliveryContent || null;
  };

  const toggleStock = (key: string) => {
    setStockVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = (key: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
      toast({ title: "Copied to clipboard" });
    });
  };

  return (
    <div className="min-h-screen bg-[#111] flex flex-col pb-20">
      <div className="max-w-lg w-full mx-auto px-4 pt-6 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setLocation("/orders")}
            className="flex items-center gap-1.5 text-white/45 hover:text-white transition-colors text-sm"
            data-testid="btn-back"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="border-b border-white/10 flex gap-8 mb-6">
          {(["info", "products"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "text-primary border-primary"
                  : "text-white/45 border-transparent hover:text-white/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "info" && (
          <div className="space-y-5">
            <InfoRow label="ID" value={<span className="font-mono break-all text-sm text-white">{order.orderId}</span>} />
            <InfoRow label="Creation date" value={formatDateTime(order.createdAt)} />
            <InfoRow label="Reason" value="cart" />
            <InfoRow label="Expected amount" value={`$${(expected / 100).toFixed(2)}`} />
            <InfoRow label="Paid amount" value={`$${(paid / 100).toFixed(2)}`} />
            <InfoRow label="Status" value={
              <span className={`font-bold ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
            } />

          </div>
        )}

        {activeTab === "products" && (
          <div className="space-y-8">
            {/* ACH / direct-delivery orders (no orderItems, deliveryContent is a plain string) */}
            {grouped.length === 0 && order.deliveryContent && isFulfilled && (() => {
              const key = "direct";
              const isOpen = !!stockVisible[key];
              const wasCopied = !!copied[key];
              const isAch = (order.orderId ?? "").startsWith("ACH-");
              const isCard = (order.orderId ?? "").startsWith("CARD-");
              const label = isAch ? "ACH Account" : isCard ? "Card" : "Item";
              return (
                <div className="space-y-4">
                  <InfoRow label="Type" value={<span className="font-bold text-sm text-white">{label}</span>} />
                  <InfoRow label="Price" value={`$${(order.total / 100).toFixed(2)}`} />
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => toggleStock(key)}
                      className="w-full h-11 rounded-xl bg-[#3b5bdb] hover:bg-[#3451c7] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isOpen ? `Hide ${label}` : `View ${label}`}
                    </button>
                    {isOpen && (
                      <div className="bg-[#111]/5 border border-white/10 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-mono text-white whitespace-pre-wrap leading-relaxed break-all">
                          {order.deliveryContent}
                        </p>
                        <button
                          onClick={() => handleCopy(key, order.deliveryContent || "")}
                          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-bold transition-colors"
                        >
                          {wasCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {wasCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Standard orders with orderItems */}
            {grouped.length === 0 && !order.deliveryContent && (
              <p className="text-sm text-white/45">No products found</p>
            )}
            {grouped.map((item, idx) => {
              const stockContent = getStockForKey(item);
              const isOpen = !!stockVisible[item.key];
              const wasCopied = !!copied[item.key];

              return (
                <div key={item.key}>
                  <div className="space-y-4">
                    <InfoRow label="Product" value={<span className="font-bold text-sm text-white">{item.productName}</span>} />
                    <InfoRow label="Option" value={item.variantName} />
                    <InfoRow label="Quantity" value={String(item.qty)} />
                    <InfoRow label="Unit price" value={`$${(item.unitPrice / 100).toFixed(2)}`} />
                    <InfoRow label="Total" value={<span className="font-bold text-sm text-white">${((item.unitPrice * item.qty) / 100).toFixed(2)}</span>} />

                    {stockContent ? (
                      <div className="space-y-2 pt-1">
                        <button
                          onClick={() => toggleStock(item.key)}
                          className="w-full h-11 rounded-xl bg-[#3b5bdb] hover:bg-[#3451c7] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                        >
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {isOpen
                            ? `Hide ${item.itemType === "card" ? "Card" : item.itemType === "ach" ? "Account" : "Stock"}`
                            : `View ${item.itemType === "card" ? "Card" : item.itemType === "ach" ? "Account" : "Stock"}`}
                        </button>

                        {isOpen && (
                          <div className="bg-[#111]/5 border border-white/10 rounded-xl p-4 space-y-3">
                            {stockContent.split(/\n\n+/).filter(Boolean).map((chunk, ci, arr) => (
                              <div key={ci}>
                                <p className="text-xs font-mono text-white whitespace-pre-wrap leading-relaxed break-all">
                                  {chunk.trim()}
                                </p>
                                {ci < arr.length - 1 && (
                                  <div className="my-3 border-t border-white/10" />
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => handleCopy(item.key, stockContent)}
                              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-bold transition-colors"
                            >
                              {wasCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {wasCopied ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-11 rounded-xl bg-[#0d0d0d] border border-white/10 text-white/40 font-bold text-sm flex items-center justify-center">
                        {isFulfilled ? "No stock data" : "Pending Order"}
                      </div>
                    )}
                  </div>

                  {idx < grouped.length - 1 && <div className="border-b border-white/10 mt-6" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div>
      <p className="text-xs text-white/45 mb-1">{label}</p>
      {typeof value === "string" ? <p className="text-sm text-white">{value}</p> : value}
    </div>
  );
}
