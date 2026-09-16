import { useState, useMemo } from "react";
import { useOrders } from "@/hooks/use-orders";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

type TabType = "all" | "cards" | "ach" | "logs";

function getTier(totalDepositsCents: number): { label: string; discount: string } {
  const dollars = totalDepositsCents / 100;
  if (dollars >= 500) return { label: "Gold", discount: "15% off" };
  if (dollars >= 200) return { label: "Silver", discount: "10% off" };
  if (dollars >= 50) return { label: "Bronze", discount: "5% off" };
  return { label: "Starter", discount: "0% off" };
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function isAchOrder(order: any): boolean {
  return (order.orderId ?? "").startsWith("ACH-");
}

function isCardOrder(order: any): boolean {
  return (
    (order.orderId ?? "").startsWith("CARD-") ||
    (!isAchOrder(order) && (order.items ?? []).some((i: any) => i.itemType === "card" || i.cardId != null))
  );
}

function isLogOrder(order: any): boolean {
  return !isCardOrder(order) && !isAchOrder(order);
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    fulfilled: { label: "FULFILLED", cls: "bg-red-900/40 text-red-400" },
    delivering: { label: "FULFILLED", cls: "bg-red-900/40 text-red-400" },
    pending: { label: "PENDING", cls: "bg-yellow-900/40 text-yellow-400" },
    waiting_payment: { label: "UNPAID", cls: "bg-orange-900/40 text-orange-400" },
    refunded: { label: "REFUNDED", cls: "bg-red-900/40 text-red-400" },
    replaced: { label: "REPLACED", cls: "bg-blue-900/40 text-blue-400" },
  };
  const entry = map[status] ?? { label: status?.toUpperCase() ?? "—", cls: "bg-[#0d0d0d] text-white/45" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

export default function OrdersPage() {
  const { data: orders, isLoading, isError, refetch, isRefetching } = useOrders();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabType>("all");
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const exportOrders = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/orders/export", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to export orders.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Orders exported", description: "Your text file is downloading." });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export orders.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const createVouch = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest("POST", "/api/vouches/create-token", { orderId });
      return response.json() as Promise<{ telegramUrl: string }>;
    },
    onSuccess: (result) => {
      window.location.assign(result.telegramUrl);
    },
    onError: (error: Error) => {
      toast({
        title: "Vouch unavailable",
        description: error.message.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
  });

  const { data: transactions } = useQuery<any[]>({
    queryKey: ["/api/wallet/transactions"],
    enabled: !!user,
  });

  const { data: features } = useQuery<any>({
    queryKey: ["/api/settings/features"],
    enabled: !!user,
  });

  const totalDepositsCents = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter((t: any) => t.type === "deposit" || t.type === "manual_deposit")
      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
  }, [transactions]);

  const tier = getTier(totalDepositsCents);
  const allOrders = orders ?? [];

  const totalSpentCents = useMemo(() => {
    return allOrders
      .filter((o: any) => o.status === "fulfilled" || o.status === "delivering" || o.status === "replaced")
      .reduce((sum: number, o: any) => sum + (o.total ?? 0), 0);
  }, [allOrders]);

  const cardOrders = useMemo(() => allOrders.filter(isCardOrder), [allOrders]);
  const achOrders = useMemo(() => allOrders.filter(isAchOrder), [allOrders]);
  const logOrders = useMemo(() => allOrders.filter(isLogOrder), [allOrders]);

  const tabOrders = tab === "cards" ? cardOrders : tab === "ach" ? achOrders : tab === "logs" ? logOrders : allOrders;

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return tabOrders;
    const q = search.toLowerCase();
    return tabOrders.filter((o: any) =>
      (o.orderId ?? "").toLowerCase().includes(q) ||
      (o.status ?? "").toLowerCase().includes(q)
    );
  }, [tabOrders, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-red-400">
        Failed to load orders. Please refresh.
      </div>
    );
  }

  const now = new Date();

  const showCards = features?.checker === true || features?.cards === true;
  const showLogs = features?.logs === true;

  const tabs: { key: TabType; label: string; count: number; href?: string }[] = [
    { key: "all", label: "all", count: allOrders.length },
    ...(showCards ? [{ key: "cards" as TabType, label: "cards", count: cardOrders.length, href: "/cards" }] : []),
    ...(achOrders.length > 0 ? [{ key: "ach" as TabType, label: "ach", count: achOrders.length }] : []),
    ...(showLogs ? [{ key: "logs" as TabType, label: "logs", count: logOrders.length, href: "/shop" }] : []),
  ];

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-5 sm:py-6 space-y-4">

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">
          <span className="text-primary">{allOrders.length}</span> Orders Found
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 border border-white/10 bg-[#111] rounded px-3 py-1.5 text-xs text-white/45 hover:text-white/70 transition-all disabled:opacity-50"
            data-testid="btn-refresh"
          >
            <RefreshCw className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportOrders}
            disabled={isExporting}
            className="flex items-center gap-1.5 border border-primary/30 bg-primary/10 rounded px-3 py-1.5 text-xs text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
            data-testid="btn-export-orders"
          >
            <Download className="h-3 w-3" />
            {isExporting ? "Exporting..." : "Export"}
          </button>
          <a href="https://t.me/+3-lMkt-idutkOTIx" target="_blank" rel="noopener noreferrer">
            <button className="flex items-center gap-1.5 border border-white/10 bg-[#111] rounded px-3 py-1.5 text-xs text-white/45 hover:text-white/70 transition-all" data-testid="btn-support">
              Support
            </button>
          </a>
        </div>
      </div>

      {/* Deposits + Tier panel */}
      <div className="border border-white/10 bg-[#0d0d0d] rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Total Deposits</p>
          <p className="text-2xl font-mono font-bold text-white">${(totalDepositsCents / 100).toFixed(2)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Tier</p>
          <p className="text-sm font-bold text-white">{tier.label} <span className="text-white/45 font-normal">· {tier.discount}</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-white/10 overflow-x-auto">
        {tabs.map(t => (
          <div key={t.key} className="flex items-center gap-1 mr-4">
            <button
              onClick={() => setTab(t.key)}
              className={`px-1 pb-2 text-xs transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? "text-white border-white"
                  : "text-white/40 border-transparent hover:text-white/60"
              }`}
              data-testid={`tab-${t.key}`}
            >
              {t.label} <span className="text-white/40">{t.count}</span>
            </button>
            {t.href && (
              <Link href={t.href}>
                <span className="text-[9px] pb-2 -mb-px text-red-400 hover:text-red-300 cursor-pointer font-mono underline underline-offset-2 transition-colors" data-testid={`link-shop-${t.key}`}>
                  shop →
                </span>
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="search orders..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-[#0d0d0d] border border-white/10 rounded py-2 px-3 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/10 transition-colors"
        data-testid="input-search-orders"
      />

      {/* Order list */}
      {filteredOrders.length === 0 ? (
        <p className="text-xs text-white/40 py-4">no orders found.</p>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order: any) => {
            const isCard = isCardOrder(order);
            const isFulfilled = order.status === "fulfilled" || order.status === "delivering" || order.status === "replaced";
            const vouchStatus = order.vouchStatus as "pending" | "approved" | "rejected" | null;
            return (
              <div
                key={order.id}
                onClick={() => setLocation(`/order/${order.orderId}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setLocation(`/order/${order.orderId}`);
                  }
                }}
                role="button"
                tabIndex={0}
                className="w-full text-left border border-white/10 bg-[#0d0d0d] rounded-lg px-4 py-3 hover:bg-[#111]/5 hover:border-white/10 transition-all"
                data-testid={`btn-order-${order.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-mono text-white/40 truncate">#{order.orderId}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isCard ? "bg-blue-900/30 text-blue-400" : isAchOrder(order) ? "bg-cyan-900/30 text-cyan-400" : "bg-purple-900/30 text-purple-400"}`}>
                        {isCard ? "card" : isAchOrder(order) ? "ach" : "log"}
                      </span>
                    </div>
                    <p className="text-xs text-white/60">
                      {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                    <p className="text-[10px] text-white/30 font-mono">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-US") : ""}
                    </p>
                  </div>
                  <div className="text-right space-y-1 flex-shrink-0">
                    {statusBadge(order.status)}
                    <p className="text-sm font-mono text-white">${(order.total / 100).toFixed(2)}</p>
                  </div>
                </div>
                {vouchStatus === "approved" ? (
                  <p className="mt-3 pt-3 border-t border-white/10 text-[10px] text-green-400">
                    ✅ Vouch Submitted — $0.50 Credit Awarded
                  </p>
                ) : vouchStatus === "pending" ? (
                  <p className="mt-3 pt-3 border-t border-white/10 text-[10px] text-yellow-400">
                    ⏳ Vouch Under Review
                  </p>
                ) : vouchStatus === "rejected" ? (
                  <p className="mt-3 pt-3 border-t border-white/10 text-[10px] text-red-400">
                    ❌ Vouch Rejected
                  </p>
                ) : isFulfilled ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const confirmed = window.confirm(
                        "Submit a vouch for this order? Send an image showing your genuine experience through our Telegram bot. Approved genuine vouches receive $0.50 in site credit.",
                      );
                      if (confirmed) createVouch.mutate(order.id);
                    }}
                    disabled={createVouch.isPending}
                    className="mt-3 w-full border border-red-500/30 bg-red-500/10 rounded px-3 py-2 text-[10px] font-bold text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    data-testid={`btn-submit-vouch-${order.id}`}
                  >
                    {createVouch.isPending ? "Generating secure link..." : "📸 Submit Vouch"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
