import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/hooks/use-orders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Package, Gift, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDate as safeFormatDate } from "@/lib/date-utils";

const RANKS = [
  { key: "newbie",  label: "Newbie",  emoji: "🌱", color: "text-white/45",  bar: "#ffffff40", bg: "bg-[#0d0d0d]",        discount: 0,  threshold: 0       },
  { key: "regular", label: "Regular", emoji: "⭐", color: "text-blue-400",  bar: "#60a5fa",   bg: "bg-blue-500/10",    discount: 2,  threshold: 10000   },
  { key: "vip",     label: "VIP",     emoji: "💎", color: "text-purple-400",bar: "#c084fc",   bg: "bg-purple-500/10",  discount: 5,  threshold: 50000   },
  { key: "nyc",     label: "NYC",     emoji: "🫆", color: "text-amber-400", bar: "#fbbf24",   bg: "bg-amber-500/10",   discount: 10, threshold: 100000  },
] as const;

function RankCard({ rankData }: { rankData: any }) {
  const current = RANKS.find(r => r.key === rankData.rank) ?? RANKS[0];
  const currentIdx = RANKS.findIndex(r => r.key === rankData.rank);
  const next = RANKS[currentIdx + 1] ?? null;
  const totalDeposited = rankData.totalDeposited ?? 0;
  const progress = next
    ? Math.min(100, Math.round(((totalDeposited - current.threshold) / (next.threshold - current.threshold)) * 100))
    : 100;

  return (
    <div className={`rounded-xl border border-white/10 ${current.bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{current.emoji}</span>
          <div>
            <p className={`text-sm font-bold ${current.color}`}>{current.label}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Your rank</p>
          </div>
        </div>
        {current.discount > 0 && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full border ${current.color} border-current/30`}>
            {current.discount}% off all orders
          </span>
        )}
        {current.discount === 0 && (
          <span className="text-xs text-white/30 font-mono">no discount yet</span>
        )}
      </div>

      {next && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-white/40">
            <span>${(totalDeposited / 100).toFixed(0)} deposited</span>
            <span>${(next.threshold / 100).toFixed(0)} for {next.label}</span>
          </div>
          <div className="h-1 rounded-full bg-[#0d0d0d] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, backgroundColor: current.bar }}
            />
          </div>
        </div>
      )}
      {!next && (
        <p className="text-[10px] text-amber-400/60">Max rank reached — {current.discount}% discount on every order</p>
      )}

      <div className="grid grid-cols-4 gap-1 pt-1">
        {RANKS.map((r, i) => (
          <div key={r.key} className={`text-center py-1.5 rounded-lg ${i <= currentIdx ? r.bg : "bg-[#0d0d0d]"} border border-white/10`}>
            <div className="text-sm">{r.emoji}</div>
            <div className={`text-[9px] font-bold mt-0.5 ${i <= currentIdx ? r.color : "text-white/30"}`}>{r.label}</div>
            <div className="text-[8px] text-white/30">{r.discount > 0 ? `${r.discount}%` : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const { data: orders } = useOrders();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { data: rankData } = useQuery<any>({ queryKey: ["/api/user/rank"] });

  const tabFromUrl = new URLSearchParams(search).get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "dashboard");

  useEffect(() => {
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  if (isLoading || !user) return <div className="flex h-screen items-center justify-center bg-[#0d0d0d]"><Loader2 className="h-7 w-7 animate-spin text-white/40" /></div>;

  return (
    <div className="space-y-5 pb-20">
      <div>
        <p className="text-[11px] text-white/40 uppercase tracking-widest">Your account</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Dashboard</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start border-b border-white/10 bg-transparent p-0 h-auto rounded-none gap-5">
          <TabsTrigger value="dashboard" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-700 data-[state=active]:bg-transparent px-0 py-2.5 text-xs font-semibold text-white/45 data-[state=active]:text-red-400">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-700 data-[state=active]:bg-transparent px-0 py-2.5 text-xs font-semibold text-white/45 data-[state=active]:text-red-400">
            Orders
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-700 data-[state=active]:bg-transparent px-0 py-2.5 text-xs font-semibold text-white/45 data-[state=active]:text-red-400">
            Settings
          </TabsTrigger>
          <TabsTrigger value="balance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-700 data-[state=active]:bg-transparent px-0 py-2.5 text-xs font-semibold text-white/45 data-[state=active]:text-red-400">
            Balance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="pt-6 space-y-4">
          {rankData && <RankCard rankData={rankData} />}
          <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/10">
              <p className="text-xs font-semibold text-white">Account Information</p>
            </div>
            <div className="divide-y divide-white/[0.05]">
              <div className="px-4 py-3 flex justify-between items-center">
                <p className="text-[11px] text-white/40">Username</p>
                <p className="text-xs font-semibold text-white">{user.username}</p>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <p className="text-[11px] text-white/40">Email</p>
                <p className="text-xs font-semibold text-white">{user.email}</p>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <p className="text-[11px] text-white/40">Telegram</p>
                <p className="text-xs font-semibold text-white">{user.telegramUsername || "—"}</p>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <p className="text-[11px] text-white/40">Member Since</p>
                <p className="text-xs text-white/60">{safeFormatDate(user.createdAt)}</p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-white/10">
              <button
                onClick={() => logout()}
                className="w-full h-9 bg-destructive/15 border border-destructive/25 text-destructive rounded-xl hover:bg-destructive/25 transition-colors font-semibold text-xs"
              >
                Sign Out
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="pt-6">
          <OrdersTab orders={orders || []} onNavigate={setLocation} />
        </TabsContent>

        <TabsContent value="settings" className="pt-6">
          <SettingsTab user={user} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/user"] })} />
        </TabsContent>

        <TabsContent value="balance" className="pt-6">
          <BalanceTab user={user} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/user"] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function parseDeliveryContent(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>;
  } catch {}
  return null;
}

function OrdersTab({ orders, onNavigate }: { orders: any[]; onNavigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(c => ({ ...c, [key]: true }));
    setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 2000);
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-bold">No orders yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-white/40 uppercase tracking-widest mb-4">
        {orders.length} Order{orders.length !== 1 ? "s" : ""}
      </p>
      {orders.map((order: any) => {
        const isDelivered = order.status === "fulfilled" || order.status === "delivering" || order.status === "replaced";
        const deliveryMap = isDelivered ? parseDeliveryContent(order.deliveryContent) : null;
        const hasContent = deliveryMap && Object.keys(deliveryMap).length > 0;
        const isOpen = expanded[order.id];

        return (
          <div
            key={order.id}
            className="bg-[#0d0d0d] rounded-2xl border border-white/10 overflow-hidden"
          >
            <button
              onClick={() => hasContent ? setExpanded(e => ({ ...e, [order.id]: !e[order.id] })) : onNavigate(`/order/${order.orderId}`)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">${(order.total / 100).toFixed(2)}</span>
                    <span className={`text-[10px] font-semibold ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-0.5 font-mono">#{order.orderId} · {formatDate(order.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasContent && (
                  isOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-white/30" />
                    : <ChevronDown className="h-3.5 w-3.5 text-white/30" />
                )}
              </div>
            </button>

            {isOpen && hasContent && (
              <div className="border-t border-white/10 divide-y divide-white/[0.04]">
                {Object.entries(deliveryMap!).map(([variantId, content]) => (
                  <div key={variantId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">Delivered</span>
                      <button
                        onClick={() => copyText(content, `${order.id}-${variantId}`)}
                        className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                      >
                        {copied[`${order.id}-${variantId}`]
                          ? <><Check className="h-3 w-3 text-red-400" /> <span className="text-red-400">Copied</span></>
                          : <><Copy className="h-3 w-3" /> Copy</>
                        }
                      </button>
                    </div>
                    <pre className="text-[11px] text-white/70 font-mono whitespace-pre-wrap break-all leading-relaxed bg-[#060606] rounded-xl px-3 py-2.5 max-h-48 overflow-y-auto">
                      {content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BalanceTab({ user, onUpdate }: { user: any; onUpdate: () => void }) {
  const [code, setCode] = useState("");
  const { toast } = useToast();

  const redeemMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wallet/redeem", { code: code.trim() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to redeem code");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Code redeemed!", description: `+$${(data.amountAdded / 100).toFixed(2)} added to your balance` });
      setCode("");
      onUpdate();
    },
    onError: (e: any) => {
      toast({ title: "Invalid code", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <Card className="bg-[#111] border-white/10">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Current Balance</span>
            <span className="text-2xl font-bold text-white">${((user.balance || 0) / 100).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#111] border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Redeem Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Gift Card / Redeem Code</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="bg-[#0d0d0d] border-white/10 text-white font-mono placeholder:text-white/30 h-11"
              data-testid="input-redeem-code"
            />
          </div>
          <Button
            className="w-full h-11"
            onClick={() => redeemMutation.mutate()}
            disabled={redeemMutation.isPending || !code.trim()}
            data-testid="button-redeem"
          >
            {redeemMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
            Redeem
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function statusLabel(s: string) {
  if (s === "pending") return "Pending";
  if (s === "waiting_payment") return "Unpaid";
  if (s === "fulfilled") return "Delivered";
  if (s === "delivering") return "Delivered";
  if (s === "refunded") return "Refunded";
  if (s === "replaced") return "Replaced";
  return s;
}

function statusColor(s: string) {
  if (s === "pending") return "text-blue-400";
  if (s === "waiting_payment") return "text-yellow-400";
  if (s === "fulfilled" || s === "delivering") return "text-red-400";
  if (s === "refunded") return "text-orange-400";
  if (s === "replaced") return "text-blue-400";
  return "text-white/45";
}

function formatDate(d: string) {
  return safeFormatDate(d, { month: "numeric", day: "numeric", year: "numeric" });
}

function SettingsTab({ user, onUpdate }: { user: any; onUpdate: () => void }) {
  const [newTelegram, setNewTelegram] = useState(user.telegramUsername || "");
  const [newEmail, setNewEmail] = useState(user.email || "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  const emailMutation = useMutation({
    mutationFn: async () => {
      if (!newEmail.trim()) throw new Error("Email is required");
      if (newEmail !== confirmEmail) throw new Error("Emails do not match");
      if (!newEmail.includes("@")) throw new Error("Invalid email");
      const res = await apiRequest("PATCH", "/api/user/email", { email: newEmail });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email updated" });
      setConfirmEmail("");
      onUpdate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  });

  const telegramMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/user/telegram", { telegramUsername: newTelegram });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Telegram updated" });
      onUpdate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      if (newPassword.length < 12) throw new Error("Password must be at least 12 characters");
      const res = await apiRequest("PATCH", "/api/user/password", { currentPassword, newPassword });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  });

  return (
    <div className="space-y-6">
      <Card className="bg-card/40 border-white/10">
        <CardHeader>
          <CardTitle>Update Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-2">New Email</label>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@example.com"
              className="bg-[#0d0d0d] border-white/10 text-white"
              data-testid="input-new-email"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Confirm Email</label>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="name@example.com"
              className="bg-[#0d0d0d] border-white/10 text-white"
              data-testid="input-confirm-email"
            />
          </div>
          <Button
            onClick={() => emailMutation.mutate()}
            disabled={emailMutation.isPending || !newEmail.trim() || !confirmEmail.trim()}
            className="w-full"
            data-testid="button-update-email"
          >
            {emailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Email
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card/40 border-white/10">
        <CardHeader>
          <CardTitle>Update Telegram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Telegram Username</label>
            <Input
              value={newTelegram}
              onChange={(e) => setNewTelegram(e.target.value)}
              placeholder="@username"
              className="bg-[#0d0d0d] border-white/10 text-white"
            />
          </div>
          <Button
            onClick={() => telegramMutation.mutate()}
            disabled={telegramMutation.isPending || !newTelegram.trim()}
            className="w-full"
          >
            {telegramMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Telegram
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card/40 border-white/10">
        <CardHeader>
          <CardTitle>Update Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Current Password</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-[#0d0d0d] border-white/10 text-white" placeholder="Enter current password" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-2">New Password</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-[#0d0d0d] border-white/10 text-white" placeholder="Enter new password" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Confirm New Password</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-[#0d0d0d] border-white/10 text-white" placeholder="Confirm new password" />
          </div>
          <Button
            onClick={() => passwordMutation.mutate()}
            disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="w-full"
          >
            {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
