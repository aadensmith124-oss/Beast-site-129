 import { useAuth } from "@/hooks/use-auth";
import { useProducts } from "@/hooks/use-products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, Pencil, X, Users, DollarSign, ShoppingBag, Receipt, ShieldX, Menu, ChevronRight, ChevronDown, Link2, Star, Package, Wallet, Pin, Gift, Tag, Copy, Check, Upload, ImageIcon, LayoutDashboard, CreditCard, MessageSquare, Settings, BadgeCheck, Code2, Megaphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SiBitcoin, SiCashapp } from "react-icons/si";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime } from "@/lib/date-utils";

const adminSections = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "products",  label: "Products",  Icon: Package },
  { id: "cards", label: "Cards",      Icon: CreditCard },
  { id: "orders",   label: "Orders",     Icon: ShoppingBag },
  { id: "cashapp",  label: "Payments",   Icon: DollarSign },
  { id: "deposits", label: "Deposits",   Icon: Wallet },
  { id: "users",    label: "Users",      Icon: Users },
  { id: "support",  label: "Support",    Icon: MessageSquare },
  { id: "codes",    label: "Codes",      Icon: Gift },
  { id: "announcements", label: "Announcements", Icon: Megaphone },
  { id: "integrations", label: "Settings", Icon: Settings },
];

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");

  const isAdmin = user?.role === "admin";

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0d0d0d] gap-3">
        <ShieldX className="h-12 w-12 text-red-400" />
        <p className="text-base font-bold text-white/70">Access Denied</p>
        <p className="text-sm text-white/40">Admin accounts only</p>
      </div>
    );
  }

  const activeLabel = adminSections.find(s => s.id === activeSection)?.label ?? "";

  return (
    <div className="flex h-screen bg-[#0d0d0d] overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-white/10 bg-[#111]">
        <div className="px-5 py-5 border-b border-white/8">
          <p className="text-base font-black text-white">
            Turtle<span className="text-primary">CC</span>
          </p>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-0.5">Admin</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {adminSections.map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                data-testid={`admin-nav-${id}`}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                style={{
                  background: active ? "hsl(38 95% 55% / 0.15)" : undefined,
                  color: active ? "hsl(38 95% 55%)" : "#6b7280",
                  border: active ? "1px solid hsl(38 95% 55% / 0.25)" : "1px solid transparent",
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "#d1d5db"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? "hsl(38 95% 55% / 0.15)" : ""; (e.currentTarget as HTMLElement).style.color = active ? "hsl(38 95% 55%)" : "#6b7280"; }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-60" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/8">
          <button
            onClick={() => setLocation("/")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-[#111]/5 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            Back to site
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile header */}
        <header className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 bg-[#111] border-b border-white/10">
          <div>
            <p className="text-sm font-black text-white">
              Turtle<span className="text-primary">CC</span>
              <span className="ml-1.5 text-xs font-normal text-white/40">Admin</span>
            </p>
            <p className="text-[10px] text-white/40 font-mono">{activeLabel}</p>
          </div>
          <button
            onClick={() => setLocation("/")}
            className="text-xs text-white/45 border border-white/10 rounded-lg px-2.5 py-1.5 hover:bg-[#0d0d0d] transition-colors"
          >
            ← Site
          </button>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {activeSection === "dashboard"    && <DashboardSection />}
          {activeSection === "products"     && <ProductsSection />}
          {activeSection === "cards"        && <AdminCardsSection />}
          {activeSection === "orders"       && <OrdersSection />}
          {activeSection === "cashapp"      && <CashAppSection />}
          {activeSection === "users"        && <UsersSection />}
          {activeSection === "support"      && <SupportSection />}
          {activeSection === "codes"        && <CodesSection />}
          {activeSection === "deposits"     && <DepositsSection />}
          {activeSection === "announcements" && <AnnouncementsSection />}
          
          {activeSection === "integrations" && <IntegrationsSection />}
        </main>

        {/* ── Mobile bottom tab bar ── */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-50 flex overflow-x-auto bg-[#111] border-t border-white/10"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {adminSections.map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                data-testid={`admin-tab-${id}`}
                className={`shrink-0 flex flex-col items-center gap-0.5 py-2 px-3 min-w-[60px] transition-colors ${active ? "text-primary" : "text-white/40"}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[9px] font-medium">{label}</span>
                {active && (
                  <span className="mt-0.5 w-4 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function DashboardSection() {
  const { toast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: [api.admin.dashboard.path],
    queryFn: async () => {
      const res = await fetch(api.admin.dashboard.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    }
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/clear-all-data", {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      setConfirmClear(false);
      queryClient.invalidateQueries();
      toast({ title: "All data cleared", description: "Products, orders, cards, and balances have been wiped." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Users" value={stats?.totalUsers || 0} icon={Users} />
        <StatCard title="Total Orders" value={stats?.totalOrders || 0} icon={ShoppingBag} />
        <StatCard title="Total Sales" value={`$${((stats?.totalSales || 0) / 100).toFixed(2)}`} icon={DollarSign} color="red" />
        <StatCard title="Pending Orders" value={stats?.pendingOrders || 0} icon={Receipt} color="orange" />
        <StatCard title="Stock Worth" value={`$${((stats?.stockWorth || 0) / 100).toFixed(2)}`} icon={Package} color="gold" />
      </div>

      <div className="border border-red-500/20 bg-red-950/10 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-red-400">Danger Zone</p>
          <p className="text-xs text-white/45 mt-0.5">Permanently wipe all products, orders, cards, and reset all user balances to $0.</p>
        </div>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
            data-testid="btn-clear-all-data"
          >
            Clear All Site Data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-xs text-red-300 font-mono">Are you sure? This cannot be undone.</p>
            <button
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              className="px-3 py-1.5 rounded bg-red-500 text-white text-xs font-black hover:bg-red-600 transition-colors disabled:opacity-50"
              data-testid="btn-clear-confirm"
            >
              {clearAllMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, wipe everything"}
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1.5 rounded bg-[#0d0d0d] text-white/45 text-xs hover:bg-[#111]/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AnnouncementsSection() {
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [active, setActive] = useState(true);
  const [bannerColor, setBannerColor] = useState("#5a0000");
  const { toast } = useToast();

  const { data: announcements = [], isLoading } = useQuery<Array<{
    id: number;
    content: string;
    link: string | null;
    active: boolean;
    createdAt: string;
  }>>({
    queryKey: ["/api/admin/announcements"],
  });

  const { data: announcementConfig } = useQuery<{ bannerColor: string }>({
    queryKey: ["/api/admin/announcements/config"],
  });

  useEffect(() => {
    if (announcementConfig?.bannerColor) setBannerColor(announcementConfig.bannerColor);
  }, [announcementConfig?.bannerColor]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/announcements", {
        content: content.trim(),
        ...(link.trim() ? { link: link.trim() } : {}),
        active,
      });
      return res.json();
    },
    onSuccess: () => {
      setContent("");
      setLink("");
      setActive(true);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement added", description: "It is now available in the announcement bar." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not add announcement", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/announcements/${id}`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update announcement", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not delete announcement", description: error.message, variant: "destructive" });
    },
  });

  const colorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/admin/announcements/config", { bannerColor });
      return res.json() as Promise<{ bannerColor: string }>;
    },
    onSuccess: (result) => {
      setBannerColor(result.bannerColor);
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements/config"] });
      toast({ title: "Banner color saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not save banner color", description: error.message, variant: "destructive" });
    },
  });

  const submit = () => {
    if (!content.trim()) {
      toast({ title: "Message required", description: "Enter the announcement text first.", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> Announcements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Publish messages in the scrolling bar shown across the customer site.
        </p>
      </div>

      <Card className="bg-[#111] border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add announcement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="announcement-content" className="text-xs font-medium text-white/60">Message</label>
            <Textarea
              id="announcement-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="e.g. New stock just landed — check the store!"
              maxLength={300}
              rows={3}
              className="bg-[#0d0d0d] border-white/10 resize-none"
              data-testid="input-announcement-content"
            />
            <p className="text-[11px] text-white/35 text-right">{content.length}/300</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="announcement-link" className="text-xs font-medium text-white/60">Link (optional)</label>
            <Input
              id="announcement-link"
              type="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://example.com"
              className="bg-[#0d0d0d] border-white/10"
              data-testid="input-announcement-link"
            />
            <p className="text-[11px] text-white/35">Customers can click the message to open this link in a new tab.</p>
          </div>

          <div className="space-y-3 rounded-lg border border-white/10 bg-[#0d0d0d] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-white">Banner color</p>
              <p className="text-xs text-white/40">Choose the background color shown behind active announcements.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={bannerColor}
                onChange={(event) => setBannerColor(event.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-white/20 bg-transparent p-1"
                aria-label="Announcement banner color"
                data-testid="input-announcement-banner-color"
              />
              <Input
                value={bannerColor}
                onChange={(event) => setBannerColor(event.target.value)}
                placeholder="#5a0000"
                maxLength={7}
                className="max-w-36 bg-[#111] border-white/10 font-mono uppercase"
                data-testid="input-announcement-banner-color-hex"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => colorMutation.mutate()}
                disabled={colorMutation.isPending || !/^#[0-9a-fA-F]{6}$/.test(bannerColor)}
                className="ml-auto border-white/10"
                data-testid="button-save-announcement-banner-color"
              >
                {colorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save color"}
              </Button>
            </div>
            <div className="h-7 rounded-md border border-white/10" style={{ backgroundColor: bannerColor }} aria-label="Banner color preview" />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-[#0d0d0d] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-white">Show immediately</p>
              <p className="text-xs text-white/40">Inactive announcements stay saved but hidden.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Show announcement immediately" />
          </div>

          <Button onClick={submit} disabled={createMutation.isPending} className="w-full gap-2" data-testid="button-add-announcement">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add announcement
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#111] border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Saved announcements ({announcements.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-white/40 text-center py-8">No announcements yet.</p>
          ) : (
            <div className="space-y-2">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0d0d0d] px-3 py-3">
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${announcement.active ? "bg-primary" : "bg-white/25"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white break-words">{announcement.content}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/40">
                      <span>{announcement.active ? "Visible" : "Hidden"}</span>
                      <span>·</span>
                      <span>{formatDateTime(announcement.createdAt)}</span>
                      {announcement.link && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[220px]">{announcement.link}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleMutation.mutate({ id: announcement.id, active: !announcement.active })}
                      disabled={toggleMutation.isPending}
                      className="h-8 text-xs border-white/10"
                    >
                      {announcement.active ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (window.confirm("Delete this announcement?")) deleteMutation.mutate(announcement.id);
                      }}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      aria-label="Delete announcement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DepositsSection() {
  const { data: deposits, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/deposits"],
    queryFn: async () => {
      const res = await fetch("/api/admin/deposits");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const statusBadge = (status: string, type: string) => {
    if (status === "fulfilled" || status === "delivering") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-mono">credited</span>;
    if (status === "pending") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-mono">{type === "cashapp" ? "awaiting admin" : "pending"}</span>;
    if (status === "waiting_payment") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-mono">unpaid</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111]/5 text-white/45 font-mono">{status}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deposits</h1>
          <p className="text-sm text-muted-foreground mt-1">All crypto and CashApp deposits from all users</p>
        </div>
        <Button size="sm" variant="outline" className="text-xs border-white/10" onClick={() => refetch()}>Refresh</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !deposits?.length ? (
        <div className="text-center py-20 text-white/40 text-sm">No deposits yet</div>
      ) : (
        <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/45 text-xs">User</TableHead>
                <TableHead className="text-white/45 text-xs">Type</TableHead>
                <TableHead className="text-white/45 text-xs">Amount</TableHead>
                <TableHead className="text-white/45 text-xs">Status</TableHead>
                <TableHead className="text-white/45 text-xs">Note</TableHead>
                <TableHead className="text-white/45 text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits.map((d: any) => (
                <TableRow key={d.id} className="border-white/10 hover:bg-[#111]/[0.02]">
                  <TableCell className="text-xs font-mono text-white/60">{d.username}</TableCell>
                  <TableCell className="text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${d.type === "crypto" ? "bg-blue-500/15 text-blue-400" : "bg-red-500/15 text-red-400"}`}>
                      {d.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-mono font-bold">${((d.amount ?? 0) / 100).toFixed(2)}</TableCell>
                  <TableCell>{statusBadge(d.status, d.type)}</TableCell>
                  <TableCell className="text-[10px] font-mono text-white/45">{d.paymentNote ?? "—"}</TableCell>
                  <TableCell className="text-[10px] text-white/45">{formatDateTime(d.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colorClass = color === "red" ? "text-red-500" : color === "orange" ? "text-orange-500" : "text-primary";
  return (
    <Card className="bg-[#111] border-white/10">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold mt-1">{value}</p>
        </div>
        <Icon className={`h-8 w-8 ${colorClass} opacity-60`} />
      </CardContent>
    </Card>
  );
}

function ProductsSection() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [managingStock, setManagingStock] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<number | null>(null);
  const [isUploadingAddImage, setIsUploadingAddImage] = useState(false);
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const { data: products, isLoading } = useProducts();

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, formType: "add" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setUploading = formType === "add" ? setIsUploadingAddImage : setIsUploadingEditImage;
    const form = formType === "add" ? addForm : editForm;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(",")[1];
        const res = await apiRequest("POST", "/api/upload", { filename: file.name, mimeType: file.type, data: base64 });
        const data = await res.json();
        form.setValue("image", data.url);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const productSchema = z.object({
    name: z.string().min(1, "Name required"),
    description: z.string().optional(),
    image: z.string().optional(),
  });

  const variantSchema = z.object({
    name: z.string().min(1, "Name required"),
    price: z.string().min(1, "Price required"),
    minQuantity: z.string().default("1"),
  });

  const addForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", image: "" },
  });

  const editForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", image: "" },
  });

  const variantForm = useForm<z.infer<typeof variantSchema>>({
    resolver: zodResolver(variantSchema),
    defaultValues: { name: "", price: "", minQuantity: "1" },
  });


  const addMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productSchema>) => {
      const res = await apiRequest("POST", api.products.create.path, { ...data, description: data.description || "" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      addForm.reset();
      setShowAddForm(false);
      toast({ title: "Product added" });
    }
  });

  const editMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productSchema>) => {
      const res = await apiRequest("PATCH", `/api/admin/products/${editingProduct.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      setEditingProduct(null);
      toast({ title: "Product updated" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({ title: "Product deleted" });
    }
  });

  const pinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: number; pinned: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/products/${id}`, { pinned });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
    }
  });

  const addVariantMutation = useMutation({
    mutationFn: async ({ productId, data }: { productId: number; data: z.infer<typeof variantSchema> }) => {
      const res = await apiRequest("POST", api.variants.create.path, {
        productId,
        name: data.name,
        price: Math.round(parseFloat(data.price) * 100),
        minQuantity: parseInt(data.minQuantity) || 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      variantForm.reset({ name: "", price: "", minQuantity: "1" });
      toast({ title: "Variant added" });
    }
  });


  const deleteVariantMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/variants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({ title: "Variant deleted" });
    }
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  const startEdit = (product: any) => {
    setEditingProduct(product);
    editForm.reset({ name: product.name, description: product.description || "", image: product.image || "" });
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button size="sm" onClick={() => { setShowAddForm(!showAddForm); setEditingProduct(null); }} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />Add Product
        </Button>
      </div>

      {showAddForm && (
        <Card className="bg-[#111] border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Add Product</CardTitle>
              <Button size="icon" variant="ghost" onClick={() => setShowAddForm(false)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
                <FormField control={addForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input {...field} className="bg-[#111]/5 border-white/10" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe the product — shown on product detail page..."
                        rows={4}
                        className="bg-[#111]/5 border-white/10 resize-none text-sm"
                      />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="image" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image <span className="text-white/40 font-normal">(optional)</span></FormLabel>
                    <div className="flex gap-2 items-start">
                      <FormControl className="flex-1">
                        <Input {...field} placeholder="https://... or upload below" className="bg-[#111]/5 border-white/10" data-testid="input-product-image" />
                      </FormControl>
                      <label className="relative cursor-pointer shrink-0">
                        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-white/10 bg-[#111]/5 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors">
                          {isUploadingAddImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Gallery
                        </div>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full" onChange={e => handleProductImageUpload(e, "add")} />
                      </label>
                    </div>
                    {field.value && (
                      <img src={field.value} alt="Preview" className="mt-2 h-20 w-20 object-cover rounded border border-white/10" onError={e => (e.currentTarget.style.display = "none")} />
                    )}
                  </FormItem>
                )} />
                <Button type="submit" size="sm" className="w-full text-xs" disabled={addMutation.isPending}>
                  {addMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Save Product
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {editingProduct && (
        <Card className="bg-[#111] border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Edit: {editingProduct.name}</CardTitle>
              <Button size="icon" variant="ghost" onClick={() => setEditingProduct(null)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4">
                <FormField control={editForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input {...field} className="bg-[#111]/5 border-white/10" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe the product — shown on product detail page..."
                        rows={4}
                        className="bg-[#111]/5 border-white/10 resize-none text-sm"
                      />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="image" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image <span className="text-white/40 font-normal">(optional)</span></FormLabel>
                    <div className="flex gap-2 items-start">
                      <FormControl className="flex-1">
                        <Input {...field} placeholder="https://... or upload below" className="bg-[#111]/5 border-white/10" data-testid="input-edit-product-image" />
                      </FormControl>
                      <label className="relative cursor-pointer shrink-0">
                        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-white/10 bg-[#111]/5 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors">
                          {isUploadingEditImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Gallery
                        </div>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full" onChange={e => handleProductImageUpload(e, "edit")} />
                      </label>
                    </div>
                    {field.value && (
                      <img src={field.value} alt="Preview" className="mt-2 h-20 w-20 object-cover rounded border border-white/10" onError={e => (e.currentTarget.style.display = "none")} />
                    )}
                  </FormItem>
                )} />
                <Button type="submit" size="sm" className="w-full text-xs" disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Update Product
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {products?.map((product: any) => (
          <div key={product.id} className="bg-[#111] border border-white/10 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-bold text-sm">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.variants?.length || 0} variant(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost" size="icon"
                  className={`h-8 w-8 ${product.pinned ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                  title={product.pinned ? "Unpin product" : "Pin to top (max 4)"}
                  disabled={pinMutation.isPending || (!product.pinned && (products?.filter((p: any) => p.pinned).length ?? 0) >= 4)}
                  onClick={() => pinMutation.mutate({ id: product.id, pinned: !product.pinned })}
                >
                  <Pin className={`h-4 w-4 ${product.pinned ? "fill-primary" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedProduct === product.id ? "rotate-180" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white/70"
                  onClick={() => startEdit(product)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => { if (confirm("Delete product?")) deleteMutation.mutate(product.id); }}
                  disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {expandedProduct === product.id && (
              <div className="border-t border-white/10 p-4 space-y-4">
                <p className="text-xs text-muted-foreground font-bold">Variants</p>

                {product.variants?.length > 0 ? (
                  <div className="space-y-2">
                    {product.variants.map((v: any) => (
                      <div key={v.id}>
                        <div className="flex items-center justify-between bg-[#0d0d0d] rounded-lg px-3 py-2 border border-white/10">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">{v.name}</span>
                            <span className="text-xs text-muted-foreground">${(v.price / 100).toFixed(2)}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${v.stockCount > 0 ? "bg-red-500/20 text-red-400" : "bg-red-500/20 text-red-400"}`}>
                              {v.stockCount || 0} in stock
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setEditingVariant(editingVariant === v.id ? null : v.id);
                              }}
                              title="Edit variant"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => setManagingStock(managingStock === v.id ? null : v.id)}
                              title="Manage stock"
                            >
                              <Package className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => { if (confirm("Delete variant?")) deleteVariantMutation.mutate(v.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {editingVariant === v.id && (
                          <EditVariantForm
                            variant={v}
                            onClose={() => setEditingVariant(null)}
                          />
                        )}
                        {managingStock === v.id && <VariantStockPanel variantId={v.id} />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No variants yet</p>
                )}

                <Form {...variantForm}>
                  <form onSubmit={variantForm.handleSubmit((d) => addVariantMutation.mutate({ productId: product.id, data: d }))}
                    className="grid grid-cols-2 gap-2 items-end">
                    <FormField control={variantForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Name</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g. 1 Month" className="bg-[#111]/5 border-white/10 h-8 text-xs" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={variantForm.control} name="minQuantity" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Min Qty</FormLabel>
                        <FormControl><Input {...field} placeholder="1" type="number" min="1" className="bg-[#111]/5 border-white/10 h-8 text-xs" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={variantForm.control} name="price" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Price ($)</FormLabel>
                        <FormControl><Input {...field} placeholder="9.99" type="number" step="0.01" className="bg-[#111]/5 border-white/10 h-8 text-xs" /></FormControl>
                      </FormItem>
                    )} />
                    <div className="col-span-2">
                      <Button type="submit" size="sm" className="w-full h-8 text-xs gap-1" disabled={addVariantMutation.isPending}>
                        {addVariantMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Add Variant
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}
          </div>
        ))}

        {(!products || products.length === 0) && (
          <div className="text-center py-12 text-muted-foreground text-sm">No products yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}

function EditVariantForm({ variant, onClose }: { variant: any; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const variantSchema = z.object({
    name: z.string().min(1, "Name required"),
    price: z.string().min(1, "Price required"),
    minQuantity: z.string().default("1"),
  });

  const form = useForm<z.infer<typeof variantSchema>>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      name: variant.name,
      price: (variant.price / 100).toFixed(2),
      minQuantity: String(variant.minQuantity ?? 1),
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof variantSchema>) => {
      const res = await apiRequest("PATCH", `/api/admin/variants/${variant.id}`, {
        name: data.name,
        price: Math.round(parseFloat(data.price) * 100),
        minQuantity: parseInt(data.minQuantity) || 1,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({ title: "Variant updated" });
      onClose();
    },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  return (
    <div className="mt-1 bg-[#111]/5 border border-primary/20 rounded-lg p-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="grid grid-cols-2 gap-2 items-end">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl><Input {...field} className="bg-[#111]/5 border-white/10 h-8 text-xs" /></FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )} />
          <FormField control={form.control} name="minQuantity" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Min Qty</FormLabel>
              <FormControl><Input {...field} type="number" min="1" className="bg-[#111]/5 border-white/10 h-8 text-xs" /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="price" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Price ($)</FormLabel>
              <FormControl><Input {...field} type="number" step="0.01" className="bg-[#111]/5 border-white/10 h-8 text-xs" /></FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )} />
          <div className="col-span-2 flex gap-2">
            <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function VariantStockPanel({ variantId }: { variantId: number }) {
  const [input, setInput] = useState("");
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["/api/admin/stock", variantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stock/${variantId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stock");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!input.trim()) throw new Error("No items to add");
      const res = await apiRequest("POST", "/api/admin/stock/bulk", { variantId, rawContent: input });
      return res.json();
    },
    onSuccess: (data) => {
      const msg = data.skippedCount > 0
        ? `Added ${data.addedCount}, skipped ${data.skippedCount} duplicate${data.skippedCount !== 1 ? "s" : ""}`
        : `Added ${data.addedCount} stock item${data.addedCount !== 1 ? "s" : ""}`;
      toast({ title: msg });
      setInput("");
      qc.invalidateQueries({ queryKey: ["/api/admin/stock", variantId] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/stock/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/stock", variantId] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Item removed" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!licenseFile) throw new Error("Choose a .txt or .csv drop file");
      const res = await fetch(`/api/admin/stock/license-file?variantId=${variantId}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        credentials: "include",
        body: licenseFile,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload drops");
      return data;
    },
    onSuccess: (data) => {
      const msg = data.skippedCount > 0
        ? `Uploaded ${data.addedCount}, skipped ${data.skippedCount} duplicate${data.skippedCount !== 1 ? "s" : ""}`
        : `Uploaded ${data.addedCount} drop${data.addedCount !== 1 ? "s" : ""}`;
      toast({ title: msg });
      setLicenseFile(null);
      qc.invalidateQueries({ queryKey: ["/api/admin/stock", variantId] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (e: any) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="mt-1 mb-2 bg-[#111]/5 rounded-lg border border-white/10 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground">
          🔥 Top Seller — {isLoading ? "..." : `${items?.length || 0} available`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"Blank line separates items:\nstock1\n\nstock2\n\nstock3"}
          rows={4}
          className="bg-black/60 border-white/10 text-xs font-mono resize-none placeholder:text-white/30"
        />
        <Button
          size="sm"
          className="w-full h-7 text-xs gap-1"
          disabled={!input.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add Stock Items
        </Button>
      </div>

      <div className="rounded border border-dashed border-primary/30 bg-primary/5 p-2.5 space-y-1.5">
        <p className="text-[10px] font-semibold text-primary/80">Upload drops</p>
        <p className="text-[9px] text-muted-foreground">
          One key per line. TXT or CSV only, up to 10,000 keys / 5 MB. Payment-card data is rejected.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            className="h-7 text-[10px] file:mr-2 file:rounded file:border-0 file:bg-primary/15 file:px-2 file:py-1 file:text-[10px] file:text-primary"
            onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)}
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-7 shrink-0 text-[10px] gap-1"
            disabled={!licenseFile || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload
          </Button>
        </div>
        {licenseFile && <p className="text-[9px] text-white/45 truncate">{licenseFile.name}</p>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : items?.length > 0 ? (
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {items.map((item: any) => (
            <div key={item.id} className="bg-[#0d0d0d] border border-white/10 rounded px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-mono text-white/45 truncate">{(item.content || "").substring(0, 80)}{(item.content || "").length > 80 ? "…" : ""}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[9px] text-white/30">avail</span>
                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-400/50 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic text-center py-1">No stock items yet</p>
      )}
    </div>
  );
}

function statusLabel(s: string) {
  if (s === "pending") return "Pending";
  if (s === "waiting_payment") return "Unpaid";
  if (s === "delivering") return "Fulfilled";
  if (s === "fulfilled") return "Fulfilled";
  if (s === "refunded") return "Refunded";
  if (s === "replaced") return "Replaced";
  return s;
}

function statusBadgeClass(s: string) {
  if (s === "pending") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (s === "waiting_payment") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "delivering" || s === "fulfilled") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "refunded") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (s === "replaced") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return "bg-[#111]/5 text-white/60";
}

function OrdersSection() {
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderFilter, setOrderFilter] = useState<"all" | "waiting" | "fulfilled" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 8000,
  });

  const cashappFulfillMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/admin/orders/${orderId}/cashapp-fulfill`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order fulfilled — items sent to user" });
    },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  });

  const markUnpaidMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/admin/orders/${orderId}/mark-unpaid`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order marked unpaid" });
    },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  });

  const refundMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/admin/orders/${orderId}/refund`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      setSelectedOrder(null);
      toast({ title: "Order refunded — balance returned to user" });
    },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  });

  const replaceMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/admin/orders/${orderId}/replace`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      setSelectedOrder(null);
      toast({ title: "Replacement stock sent to user" });
    },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  if (selectedOrder) {
    const current = orders?.find((o: any) => o.id === selectedOrder.id) || selectedOrder;
    const productItems = current.items?.filter((i: any) => !i.itemType || i.itemType === "product") || [];
    const grouped: Record<string, { productName: string; variantName: string; qty: number; unitPrice: number }> = {};
    for (const item of productItems) {
      const key = String(item.variantId || item.id);
      if (!grouped[key]) grouped[key] = { productName: item.productName || "Product", variantName: item.variant?.name || "—", qty: 0, unitPrice: item.price };
      grouped[key].qty += (item.quantity ?? 1);
    }
    const groupedEntries = Object.entries(grouped);

    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>← Back</Button>

        <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Order Detail</h2>
            <Badge className={statusBadgeClass(current.status)}>{statusLabel(current.status)}</Badge>
          </div>

          <div className="space-y-3 border-b border-white/10 pb-4">
            <div><p className="text-[10px] text-white/45 mb-0.5">Order ID</p><p className="text-xs font-mono text-white break-all">{current.orderId}</p></div>
            <div><p className="text-[10px] text-white/45 mb-0.5">Date</p><p className="text-xs text-white/70">{formatDateTime(current.createdAt)}</p></div>
            <div><p className="text-[10px] text-white/45 mb-0.5">Customer</p><p className="text-xs text-white font-bold">{current.user?.username || current.userId} · @{current.user?.telegramUsername || "—"}</p></div>
            <div><p className="text-[10px] text-white/45 mb-0.5">Payment</p><p className="text-xs text-white/70">{current.paymentMethod || "—"}</p></div>
            {current.paymentNote && (
              <div><p className="text-[10px] text-white/45 mb-0.5">Payment Note</p><p className="text-xs font-mono text-[#ff2d2d]">{current.paymentNote}</p></div>
            )}
            <div><p className="text-[10px] text-white/45 mb-0.5">Amount</p><p className="text-xs text-white/70">${(current.total / 100).toFixed(2)}</p></div>
            <div><p className="text-[10px] text-white/45 mb-0.5">Status</p><p className={`text-xs font-bold ${statusTextColor(current.status)}`}>{statusLabel(current.status)}</p></div>
          </div>

          {current.status === "pending" && current.paymentMethod === "CashApp" && (
            <div className="flex gap-3 border-b border-white/10 pb-4">
              <button
                onClick={() => { cashappFulfillMutation.mutate(current.id); }}
                disabled={cashappFulfillMutation.isPending}
                className="flex-1 h-11 rounded-xl bg-[#ff2d2d]/20 border border-[#ff2d2d]/40 text-[#ff2d2d] text-sm font-black hover:bg-[#ff2d2d]/30 transition-colors disabled:opacity-50"
                data-testid={`button-cashapp-paid-detail-${current.id}`}
              >
                {cashappFulfillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "✓ Paid — Deliver Stock"}
              </button>
              <button
                onClick={() => { markUnpaidMutation.mutate(current.id); }}
                disabled={markUnpaidMutation.isPending}
                className="flex-1 h-11 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                data-testid={`button-cashapp-unpaid-detail-${current.id}`}
              >
                ✕ Unpaid
              </button>
            </div>
          )}

          {(current.status === "delivering" || current.status === "fulfilled" || current.status === "replaced") && (
            <div className="flex gap-2 border-b border-white/10 pb-4">
              <button
                onClick={() => replaceMutation.mutate(current.id)}
                disabled={replaceMutation.isPending}
                className="flex-1 h-9 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-black hover:bg-primary/30 transition-colors disabled:opacity-50"
                data-testid={`button-replace-${current.id}`}
              >
                {replaceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : "↺ Replace (new stock)"}
              </button>
              <button
                onClick={() => refundMutation.mutate(current.id)}
                disabled={refundMutation.isPending || current.status === "refunded"}
                className="flex-1 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-black hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                data-testid={`button-refund-${current.id}`}
              >
                {refundMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : "$ Refund to Balance"}
              </button>
            </div>
          )}

          {groupedEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/45">Items Ordered</p>
              {groupedEntries.map(([key, g]) => (
                <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#0d0d0d] border border-white/10">
                  <div>
                    <p className="text-xs font-bold text-white">{g.productName}</p>
                    <p className="text-[10px] text-white/45 mt-0.5">{g.variantName} · qty {g.qty}</p>
                  </div>
                  <p className="text-xs text-white/60">${((g.unitPrice * g.qty) / 100).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}

          {groupedEntries.length === 0 && current.deliveryContent && current.orderId?.startsWith("ACH-") && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/45">ACH Account Delivered</p>
              <div className="px-3 py-2.5 rounded-xl bg-[#0d0d0d] border border-white/10">
                <p className="text-xs font-mono text-white/70 whitespace-pre-wrap break-all">{current.deliveryContent}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const filteredOrders = (orders || []).filter((o: any) => {
    if (orderFilter === "waiting") { if (!(o.paymentMethod === "CashApp" && o.status === "pending")) return false; }
    else if (orderFilter === "fulfilled") { if (!(o.status === "delivering" || o.status === "fulfilled" || o.status === "replaced")) return false; }
    if (!q) return true;
    return (
      o.orderId?.toLowerCase().includes(q) ||
      o.user?.username?.toLowerCase().includes(q) ||
      o.paymentNote?.toLowerCase().includes(q) ||
      o.paymentMethod?.toLowerCase().includes(q)
    );
  });

  const waitingCount = (orders || []).filter((o: any) => o.paymentMethod === "CashApp" && o.status === "pending").length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Orders</h1>

      <div className="relative">
        <input
          type="text"
          placeholder="Search by order ID, username, payment note..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full h-9 bg-[#0d0d0d] border border-white/10 rounded-lg px-3 pr-8 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-primary/40"
          data-testid="input-order-search"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "All" },
          { key: "waiting", label: `Unconfirmed CashApp${waitingCount > 0 ? ` (${waitingCount})` : ""}` },
          { key: "fulfilled", label: "Delivered" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setOrderFilter(key as any)}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
              orderFilter === key
                ? key === "waiting"
                  ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                  : "bg-primary/20 border-primary/40 text-primary"
                : "bg-[#0d0d0d] border-white/10 text-white/45 hover:text-white hover:border-white/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">No orders here.</div>
      )}

      <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto] px-3 py-2 border-b border-white/10 gap-2">
          <span className="text-[10px] font-bold text-white/45">$</span>
          <span className="text-[10px] font-bold text-white/45">Note / Method</span>
          <span className="text-[10px] font-bold text-white/45">Status</span>
          <span></span>
        </div>
        {filteredOrders.map((order: any) => (
          <div key={order.id} className="grid grid-cols-[auto_1fr_auto_auto] px-3 py-2.5 border-b border-white/10 last:border-0 items-center gap-2 hover:bg-[#0d0d0d] transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
            <span className="text-xs font-bold text-white">${(order.total / 100).toFixed(2)}</span>
            <div className="min-w-0">
              <p className="text-[11px] text-white/60 truncate font-mono">{order.user?.username ? `@${order.user.username}` : ""} <span className="text-white/45">{order.orderId?.slice(0, 10)}</span></p>
              <p className="text-[10px] text-white/40 truncate">{order.paymentNote || order.paymentMethod || "—"} · {formatDate(order.createdAt, { month: "short", day: "numeric" })}</p>
            </div>
            <span className={`text-[11px] font-bold ${statusTextColor(order.status)}`}>{statusLabel(order.status)}</span>
            <ChevronRight className="h-3.5 w-3.5 text-white/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

function statusTextColor(s: string) {
  if (s === "pending") return "text-yellow-400";
  if (s === "waiting_payment") return "text-red-400";
  if (s === "delivering" || s === "fulfilled") return "text-red-400";
  if (s === "refunded") return "text-orange-400";
  if (s === "replaced") return "text-blue-400";
  return "text-white/45";
}


function TestModeSection({ onGoToOrders }: { onGoToOrders: () => void }) {
  const { toast } = useToast();
  const { data: products } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [lastOrder, setLastOrder] = useState<any>(null);

  const testOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct || !selectedVariant) throw new Error("Select product and variant");
      const res = await apiRequest("POST", "/api/admin/test-order", {
        productId: selectedProduct,
        variantId: selectedVariant,
        quantity
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: (order) => {
      setLastOrder(order);
      toast({ title: "Test order created!", description: `Order ${order.orderId} created with status 'delivering'` });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  });

  const product = products?.find((p: any) => p.id === selectedProduct);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Test Mode</h1>
        <p className="text-sm text-muted-foreground mt-1">Create a fake order to test the delivery flow — no payment needed.</p>
      </div>

      <Card className="bg-[#111] border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Create Test Order (No Payment)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Product</label>
            <Select value={selectedProduct?.toString()} onValueChange={(v) => { setSelectedProduct(Number(v)); setSelectedVariant(null); }}>
              <SelectTrigger className="bg-[#111]/5 border-white/10">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent className="bg-[#111] border-white/10">
                {products?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {product && (
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Variant</label>
              <Select value={selectedVariant?.toString()} onValueChange={(v) => setSelectedVariant(Number(v))}>
                <SelectTrigger className="bg-[#111]/5 border-white/10">
                  <SelectValue placeholder="Select a variant" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10">
                  {product.variants?.map((v: any) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.name} — ${(v.price / 100).toFixed(2)} (min {v.minQuantity || 1})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground block mb-2">Quantity</label>
            <Input
              type="number" min="1" value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-[#111]/5 border-white/10"
            />
          </div>

          <Button
            size="sm"
            onClick={() => testOrderMutation.mutate()}
            disabled={testOrderMutation.isPending || !selectedProduct || !selectedVariant}
            className="w-full text-xs"
          >
            {testOrderMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Create Test Order
          </Button>
        </CardContent>
      </Card>

      {lastOrder && (
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold text-red-400">✓ Test order created!</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Order ID: <span className="font-mono text-white">{lastOrder.orderId}</span></p>
              <p>Status: <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">delivering</Badge></p>
              <p className="text-white/60">Now go to the Orders tab to paste items and fulfill this order.</p>
            </div>
            <Button size="sm" className="w-full" onClick={onGoToOrders}>
              Go to Orders →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function CopyLoginCode({ code, userId }: { code: string; userId: number }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Login code copied!" });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 font-mono text-xs text-primary/80 hover:text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded px-2 py-0.5 transition-colors"
      data-testid={`btn-copy-code-${userId}`}
      title="Copy login code"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : code}
    </button>
  );
}

function UsersSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [balanceInput, setBalanceInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const banMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest('POST', api.admin.banUser.path.replace(':id', userId.toString()));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User banned' });
      setSelectedUser((u: any) => u ? { ...u, isBanned: true } : null);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest('POST', api.admin.unbanUser.path.replace(':id', userId.toString()));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User unbanned' });
      setSelectedUser((u: any) => u ? { ...u, isBanned: false } : null);
    },
  });

  const setBalanceMutation = useMutation({
    mutationFn: async ({ userId, balance }: { userId: number; balance: string }) => {
      const res = await apiRequest('POST', `/api/admin/users/${userId}/set-balance`, { balance: parseFloat(balance) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSelectedUser((u: any) => u ? { ...u, balance: data.balance } : null);
      setBalanceInput("");
      toast({ title: `Balance set to $${(data.balance / 100).toFixed(2)}` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await apiRequest('POST', `/api/admin/users/${userId}/set-role`, { role });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSelectedUser((u: any) => u ? { ...u, role: data.role } : null);
      toast({ title: `Role set to ${data.role}` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const setWorkerMutation = useMutation({
    mutationFn: async ({ userId, isWorker }: { userId: number; isWorker: boolean }) => {
      const res = await apiRequest('POST', `/api/admin/users/${userId}/set-worker`, { isWorker });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSelectedUser((u: any) => u ? { ...u, isWorker: data.isWorker } : null);
      toast({ title: data.isWorker ? 'Worker access granted' : 'Worker access removed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const setPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${userId}/password`, { newPassword });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
      return res.json();
    },
    onSuccess: () => {
      setPasswordInput("");
      setPasswordConfirmation("");
      toast({ title: 'Password changed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  const filtered = (users ?? []).filter((u: any) =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedUser) {
    return (
      <div className="space-y-3">
        <button onClick={() => setSelectedUser(null)} className="text-xs text-white/45 hover:text-white transition-colors">← Back to Users</button>

        <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-bold text-white">{selectedUser.username}</p>
              <p className="text-[10px] text-white/40 font-mono">{selectedUser.email}</p>
            </div>
            <div className="flex gap-2 items-center">
              {selectedUser.isBanned && <Badge className="bg-red-500/20 text-red-400 text-[9px]">BANNED</Badge>}
              <Badge className={selectedUser.role === "admin" ? "bg-primary/20 text-primary border-primary/30" : "bg-[#0d0d0d] text-white/45 border-white/10"}>
                {selectedUser.role}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-[#0d0d0d] rounded-lg p-2">
              <p className="text-[9px] text-white/40">Balance</p>
              <p className="text-sm font-mono font-bold text-white">${(selectedUser.balance / 100).toFixed(2)}</p>
            </div>
            <div className="bg-[#0d0d0d] rounded-lg p-2">
              <p className="text-[9px] text-white/40">Login Code</p>
              {selectedUser.loginCode
                ? <CopyLoginCode code={selectedUser.loginCode} userId={selectedUser.id} />
                : <p className="text-xs text-white/40">—</p>}
            </div>
          </div>

          {/* Set Balance */}
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <p className="text-[9px] text-white/40 uppercase tracking-widest">Set Balance ($)</p>
            <div className="flex gap-2">
              <input
                value={balanceInput}
                onChange={e => setBalanceInput(e.target.value)}
                placeholder="e.g. 50.00"
                type="number"
                step="0.01"
                min="0"
                className="flex-1 h-8 bg-[#111]/5 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-primary/40"
                data-testid={`input-balance-${selectedUser.id}`}
              />
              <button
                onClick={() => setBalanceMutation.mutate({ userId: selectedUser.id, balance: balanceInput })}
                disabled={setBalanceMutation.isPending || !balanceInput}
                className="h-8 px-3 bg-primary/80 hover:bg-primary text-white text-xs font-bold rounded transition-colors disabled:opacity-40 flex items-center gap-1"
                data-testid={`btn-set-balance-${selectedUser.id}`}
              >
                {setBalanceMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set"}
              </button>
            </div>
          </div>

          {/* Role + Actions */}
           <div className="space-y-1.5 pt-1 border-t border-white/10">
             <p className="text-[9px] text-white/40 uppercase tracking-widest">Set Password</p>
             <div className="grid gap-2 sm:grid-cols-2">
               <input
                 value={passwordInput}
                 onChange={e => setPasswordInput(e.target.value)}
                 placeholder="New password"
                 type="password"
                 autoComplete="new-password"
                 minLength={12}
                 className="h-8 bg-[#0d0d0d] border border-white/10 rounded px-2 text-xs text-white outline-none focus:border-primary/40"
                 data-testid={`input-password-${selectedUser.id}`}
               />
               <input
                 value={passwordConfirmation}
                 onChange={e => setPasswordConfirmation(e.target.value)}
                 placeholder="Confirm new password"
                 type="password"
                 autoComplete="new-password"
                 minLength={12}
                 className="h-8 bg-[#0d0d0d] border border-white/10 rounded px-2 text-xs text-white outline-none focus:border-primary/40"
                 data-testid={`input-password-confirm-${selectedUser.id}`}
               />
             </div>
             <div className="flex items-center justify-between gap-2">
               <p className="text-[10px] text-white/35">At least 12 characters.</p>
               <button
                 onClick={() => setPasswordMutation.mutate({ userId: selectedUser.id, newPassword: passwordInput })}
                 disabled={
                   setPasswordMutation.isPending ||
                   passwordInput.length < 12 ||
                   passwordInput !== passwordConfirmation
                 }
                 className="h-8 px-3 bg-primary/80 hover:bg-primary text-white text-xs font-bold rounded transition-colors disabled:opacity-40 flex items-center gap-1"
                 data-testid={`btn-set-password-${selectedUser.id}`}
               >
                 {setPasswordMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Change Password"}
               </button>
             </div>
           </div>

           {/* Role + Actions */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-white/10">
            {selectedUser.role !== "admin" ? (
              <button
                onClick={() => { if (confirm("Make this user admin?")) setRoleMutation.mutate({ userId: selectedUser.id, role: "admin" }); }}
                disabled={setRoleMutation.isPending}
                className="h-7 px-3 bg-yellow-600/80 hover:bg-yellow-600 text-white text-xs font-bold rounded transition-colors disabled:opacity-40"
                data-testid={`btn-make-admin-${selectedUser.id}`}
              >
                Make Admin
              </button>
            ) : (
              <button
                onClick={() => { if (confirm("Remove admin from this user?")) setRoleMutation.mutate({ userId: selectedUser.id, role: "user" }); }}
                disabled={setRoleMutation.isPending}
                className="h-7 px-3 border border-yellow-700/40 text-yellow-500 text-xs font-bold rounded hover:bg-yellow-900/20 transition-colors disabled:opacity-40"
                data-testid={`btn-remove-admin-${selectedUser.id}`}
              >
                Remove Admin
              </button>
            )}
            {selectedUser.isWorker ? (
              <button
                onClick={() => setWorkerMutation.mutate({ userId: selectedUser.id, isWorker: false })}
                disabled={setWorkerMutation.isPending}
                className="h-7 px-3 border border-blue-700/40 text-blue-400 text-xs font-bold rounded hover:bg-blue-900/20 transition-colors disabled:opacity-40"
                data-testid={`btn-remove-worker-${selectedUser.id}`}
              >
                Remove Worker
              </button>
            ) : (
              <button
                onClick={() => setWorkerMutation.mutate({ userId: selectedUser.id, isWorker: true })}
                disabled={setWorkerMutation.isPending}
                className="h-7 px-3 bg-blue-700/80 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors disabled:opacity-40"
                data-testid={`btn-make-worker-${selectedUser.id}`}
              >
                Make Worker
              </button>
            )}
            {selectedUser.isBanned ? (
              <button
                onClick={() => unbanMutation.mutate(selectedUser.id)}
                disabled={unbanMutation.isPending}
                className="h-7 px-3 bg-red-700/80 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors disabled:opacity-40"
                data-testid={`btn-unban-${selectedUser.id}`}
              >
                Unban
              </button>
            ) : (
              <button
                onClick={() => { if (confirm("Ban this user?")) banMutation.mutate(selectedUser.id); }}
                disabled={banMutation.isPending}
                className="h-7 px-3 border border-red-800/40 text-red-400 text-xs font-bold rounded hover:bg-red-900/20 transition-colors disabled:opacity-40"
                data-testid={`btn-ban-${selectedUser.id}`}
              >
                Ban
              </button>
            )}
          </div>

          <div className="text-[9px] text-white/30 font-mono pt-1 border-t border-white/10 space-y-0.5">
            <p>Telegram: @{selectedUser.telegramUsername || '—'}</p>
            <p>Joined: {formatDate(selectedUser.createdAt)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Users <span className="text-white/40 font-normal">({(users ?? []).length})</span></h2>
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by username or email..."
        className="w-full h-8 bg-[#0d0d0d] border border-white/10 rounded px-3 text-xs text-white placeholder:text-white/40 outline-none"
        data-testid="input-users-search"
      />
      <div className="space-y-1.5">
        {filtered.map((user: any) => (
          <button
            key={user.id}
             onClick={() => {
               setSelectedUser(user);
               setBalanceInput("");
               setPasswordInput("");
               setPasswordConfirmation("");
             }}
            className="w-full text-left bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/10 transition-colors"
            data-testid={`btn-user-${user.id}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-white truncate">{user.username}</p>
                  {user.role === "admin" && <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px]">admin</Badge>}
                  {user.isBanned && <Badge className="bg-red-500/20 text-red-400 text-[9px]">banned</Badge>}
                </div>
                <p className="text-[10px] text-white/40 font-mono">${(user.balance / 100).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {user.loginCode && <CopyLoginCode code={user.loginCode} userId={user.id} />}
                <ChevronRight className="h-3.5 w-3.5 text-white/30" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CodesSection() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"balance" | "discount">("balance");

  // Balance codes state
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("1");
  const [generated, setGenerated] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: balanceCodes, isLoading: balanceLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/codes"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(amount) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error("Enter a valid amount");
      const qty = parseInt(count) || 1;
      if (qty < 1 || qty > 100) throw new Error("Quantity must be 1–100");
      const res = await apiRequest("POST", "/api/admin/codes", { amount: amountCents, count: qty });
      return res.json();
    },
    onSuccess: (data) => {
      setGenerated(data.codes || []);
      qc.invalidateQueries({ queryKey: ["/api/admin/codes"] });
      toast({ title: `${data.codes?.length || 0} code(s) generated` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyAll = () => {
    navigator.clipboard.writeText(generated.join("\n"));
    toast({ title: "Copied all codes" });
  };

  // Discount codes state
  const [dForm, setDForm] = useState({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", expiresAt: "" });
  const { data: discountList = [] } = useQuery<any[]>({ queryKey: ["/api/admin/discount-codes"] });

  const createDiscountMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/discount-codes", dForm),
    onSuccess: () => {
      toast({ title: "Discount code created" });
      setDForm({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", expiresAt: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discount-codes"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleDiscountMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/discount-codes/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/discount-codes"] }),
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/discount-codes/${id}`, {}),
    onSuccess: () => {
      toast({ title: "Code deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discount-codes"] });
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Codes</h1>

      {/* Tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("balance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === "balance"
              ? "bg-primary text-white"
              : "bg-[#0d0d0d] text-white/60 hover:bg-[#111]/5 hover:text-white/70"
          }`}
          data-testid="tab-balance-codes"
        >
          <Gift className="h-4 w-4" />
          Balance Codes
        </button>
        <button
          onClick={() => setTab("discount")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === "discount"
              ? "bg-primary text-white"
              : "bg-[#0d0d0d] text-white/60 hover:bg-[#111]/5 hover:text-white/70"
          }`}
          data-testid="tab-discount-codes"
        >
          <Tag className="h-4 w-4" />
          Discount Codes
        </button>
      </div>

      {/* ── BALANCE CODES TAB ── */}
      {tab === "balance" && (
        <>
          <Card className="bg-[#111] border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Create Balance Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-white/45">Amount ($)</p>
                  <Input
                    type="number" step="0.01" min="0.01" placeholder="e.g. 10.00"
                    value={amount} onChange={e => setAmount(e.target.value)}
                    className="bg-[#111]/5 border-white/10 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/45">Quantity (max 100)</p>
                  <Input
                    type="number" min="1" max="100" placeholder="1"
                    value={count} onChange={e => setCount(e.target.value)}
                    className="bg-[#111]/5 border-white/10 h-9 text-sm"
                  />
                </div>
              </div>
              <Button className="w-full gap-2" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Code
              </Button>

              {generated.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/45">Generated codes</p>
                    <button onClick={copyAll} className="text-xs text-primary hover:opacity-80 transition-opacity">Copy All</button>
                  </div>
                  <div className="bg-[#111]/5 border border-white/10 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                    {generated.map((c) => (
                      <div key={c} className="flex items-center justify-between group">
                        <span className="text-xs font-mono text-red-400">{c}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(c); toast({ title: "Copied" }); }}
                          className="text-[10px] text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                        >Copy</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#111] border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Balance Codes ({balanceCodes?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !balanceCodes?.length ? (
                <p className="text-xs text-white/45 text-center py-8">No codes generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {balanceCodes.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between bg-[#111]/5 border border-white/10 rounded-lg px-3 py-2.5">
                      <div>
                        <p className="text-sm font-bold text-white font-mono">{c.code}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-red-400">${(c.amount / 100).toFixed(2)}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.isUsed ? "bg-[#0d0d0d] text-white/40" : "bg-red-500/20 text-red-400"}`}>
                            {c.isUsed ? "Used" : "Available"}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-white/40">{formatDate(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── DISCOUNT CODES TAB ── */}
      {tab === "discount" && (
        <>
          <Card className="bg-[#111] border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Create Discount Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-white/45">Code</p>
                  <Input
                    placeholder="SAVE20"
                    value={dForm.code}
                    onChange={e => setDForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="bg-[#111]/5 border-white/10 h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/45">Type</p>
                  <select
                    value={dForm.type}
                    onChange={e => setDForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full h-9 rounded-md bg-[#111]/5 border border-white/10 text-sm text-white px-2 focus:outline-none"
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/45">{dForm.type === "percent" ? "Discount %" : "Discount $ Amount"}</p>
                  <Input
                    type="number" min="0" step={dForm.type === "percent" ? "1" : "0.01"} placeholder={dForm.type === "percent" ? "20" : "5.00"}
                    value={dForm.value}
                    onChange={e => setDForm(f => ({ ...f, value: e.target.value }))}
                    className="bg-[#111]/5 border-white/10 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/45">Min. Order $ (optional)</p>
                  <Input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={dForm.minOrder}
                    onChange={e => setDForm(f => ({ ...f, minOrder: e.target.value }))}
                    className="bg-[#111]/5 border-white/10 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/45">Max Uses (optional)</p>
                  <Input
                    type="number" min="1" placeholder="Unlimited"
                    value={dForm.maxUses}
                    onChange={e => setDForm(f => ({ ...f, maxUses: e.target.value }))}
                    className="bg-[#111]/5 border-white/10 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/45">Expires At (optional)</p>
                  <Input
                    type="datetime-local"
                    value={dForm.expiresAt}
                    onChange={e => setDForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="bg-[#111]/5 border-white/10 h-9 text-sm"
                  />
                </div>
              </div>
              <Button className="w-full gap-2" onClick={() => createDiscountMutation.mutate()} disabled={createDiscountMutation.isPending}>
                {createDiscountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Code
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#111] border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Discount Codes ({discountList.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {discountList.length === 0 ? (
                <p className="text-sm text-white/40 text-center py-6">No codes yet</p>
              ) : (
                <div className="space-y-2">
                  {discountList.map((dc: any) => (
                    <div key={dc.id} className="flex items-center gap-3 bg-[#111]/5 border border-white/10 rounded-lg px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-white font-mono">{dc.code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${dc.isActive ? "bg-primary/20 text-primary" : "bg-[#111]/5 text-white/45"}`}>
                            {dc.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/45">
                          {dc.type === "percent" ? `${dc.value}% off` : `$${(dc.value / 100).toFixed(2)} off`}
                          {dc.minOrder > 0 && ` · min $${(dc.minOrder / 100).toFixed(2)}`}
                          {` · ${dc.usedCount}/${dc.maxUses ?? "∞"} uses`}
                          {dc.expiresAt && ` · expires ${formatDate(dc.expiresAt)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => toggleDiscountMutation.mutate({ id: dc.id, isActive: !dc.isActive })}
                          className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${dc.isActive ? "border-gray-300 text-white/60 hover:bg-[#0d0d0d]" : "border-primary/30 text-primary hover:bg-primary/10"}`}
                        >
                          {dc.isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => deleteDiscountMutation.mutate(dc.id)}
                          className="px-2 py-1 rounded text-[11px] font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MinDepositCard({ method, label, color }: { method: string; label: string; color: string }) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const { data } = useQuery<Record<string, number>>({
    queryKey: ["/api/admin/settings/min-deposits"],
  });
  useEffect(() => {
    if (data && data[method] !== undefined) setInput(data[method] === 0 ? "" : String(data[method]));
  }, [data, method]);
  const saveMutation = useMutation({
    mutationFn: async (val: number) => {
      const res = await apiRequest("POST", "/api/admin/settings/min-deposits", { method, min: val });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/min-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings/min-deposits"] });
      toast({ title: `${label} min deposit saved` });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });
  return (
    <Card className="bg-[#111] border-white/10">
      <CardContent className="p-4 space-y-2">
        <p className="font-bold text-sm mb-0.5" style={{ color }}>Minimum Deposit — {label}</p>
        <p className="text-xs text-muted-foreground">Set to 0 for no minimum.</p>
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-[#0d0d0d] border-white/10 text-white font-mono"
            data-testid={`input-min-deposit-${method}`}
          />
          <Button size="sm" onClick={() => saveMutation.mutate(parseFloat(input) || 0)} disabled={saveMutation.isPending}
            data-testid={`button-save-min-deposit-${method}`}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HandleSettingCard({ label, description, settingKey, placeholder, color }: {
  label: string; description: string; settingKey: string; placeholder: string; color: string;
}) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const { data } = useQuery<{ handle?: string; tag?: string }>({
    queryKey: [`/api/admin/settings/${settingKey}`],
  });
  useEffect(() => {
    const val = data?.handle ?? data?.tag ?? "";
    if (val !== undefined) setInput(val);
  }, [data]);
  const saveMutation = useMutation({
    mutationFn: async (val: string) => {
      const body = settingKey === "cashapp-tag" ? { tag: val } : { handle: val };
      const res = await apiRequest("POST", `/api/admin/settings/${settingKey}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/settings/${settingKey}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings/manual-payments"] });
      toast({ title: `${label} saved` });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });
  return (
    <Card className="bg-[#111] border-white/10">
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="font-bold text-sm mb-0.5" style={{ color }}>{label}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{description}</p>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-[#0d0d0d] border-white/10 text-white font-mono"
              data-testid={`input-${settingKey}`}
            />
            <Button size="sm" onClick={() => saveMutation.mutate(input)} disabled={saveMutation.isPending}
              data-testid={`button-save-${settingKey}`}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeeSettingCard({ method, label, color }: { method: string; label: string; color: string }) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const { data } = useQuery<{ fee: number }>({
    queryKey: [`/api/admin/settings/${method}-fee`],
  });
  useEffect(() => {
    if (data !== undefined) setInput(String(data.fee ?? 0));
  }, [data]);
  const saveMutation = useMutation({
    mutationFn: async (val: string) => {
      const res = await apiRequest("POST", `/api/admin/settings/${method}-fee`, { fee: parseFloat(val) || 0 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/settings/${method}-fee`] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings/manual-payments"] });
      toast({ title: `${label} fee saved` });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });
  return (
    <Card className="bg-[#111] border-white/10">
      <CardContent className="p-4 space-y-2">
        <p className="font-bold text-sm mb-0.5" style={{ color }}>Fee % — {label}</p>
        <p className="text-xs text-muted-foreground">Percentage deducted from deposit before crediting. Set 0 for no fee.</p>
        <div className="flex gap-2">
          <Input
            type="number" min="0" max="100" step="1"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="0"
            className="flex-1 bg-[#0d0d0d] border-white/10 text-white font-mono"
            data-testid={`input-fee-${method}`}
          />
          <span className="flex items-center text-sm text-white/40 pr-1">%</span>
          <Button size="sm" onClick={() => saveMutation.mutate(input)} disabled={saveMutation.isPending}
            data-testid={`button-save-fee-${method}`}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsSection() {
  const { toast } = useToast();

  const { data: integrationStatus, isLoading: statusLoading } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/admin/integrations/status"],
  });

  const { data: paymentMethods, isLoading: methodsLoading } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/admin/payment-methods"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ method, enabled }: { method: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/payment-methods/${method}`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings/manual-payments"] });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const METHODS = [
    { id: "wallet", label: "Wallet / Balance", icon: <Wallet className="h-4 w-4 text-white" />, bg: "bg-primary" },
    { id: "cashapp", label: "CashApp", icon: <SiCashapp className="h-4 w-4 text-[#00D632]" />, bg: "bg-[#00D632]/15" },
    { id: "venmo", label: "Venmo", icon: <span className="text-white font-black text-sm">V</span>, bg: "bg-[#3D95CE]" },
    { id: "zelle", label: "Zelle", icon: <span className="text-white font-black text-sm">Z</span>, bg: "bg-[#6D1ED4]" },
    { id: "chime", label: "Chime", icon: <span className="text-white font-black text-sm">C</span>, bg: "bg-[#00D632]" },
    { id: "crypto", label: "Crypto", icon: <SiBitcoin className="h-4 w-4 text-white" />, bg: "bg-primary" },
    { id: "stars", label: "Telegram Stars", icon: <Star className="h-4 w-4 text-white fill-white" />, bg: "bg-blue-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" /> Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Enable or disable payment methods and manage handles.</p>
      </div>

      {/* Payment Method Toggles */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">Payment Methods (Deposits)</p>
        <div className="space-y-2">
          {methodsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : METHODS.map((m) => {
            const enabled = m.id === "chime" || m.id === "zelle"
              ? paymentMethods?.[m.id] === true
              : paymentMethods?.[m.id] !== false;
            return (
              <Card key={m.id} className="bg-[#111] border-white/10" data-testid={`card-payment-toggle-${m.id}`}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full ${m.bg} flex items-center justify-center flex-shrink-0`}>
                      {m.icon}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{enabled ? "Visible to customers" : "Hidden from customers"}</p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={(val) => toggleMutation.mutate({ method: m.id, enabled: val })}
                    data-testid={`switch-payment-${m.id}`}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Manual Payment Handles — CashApp */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">CashApp Settings</p>
        <div className="space-y-3">
          <HandleSettingCard
            label="CashApp $Cashtag"
            description="Customers send CashApp to this tag with a generated note."
            settingKey="cashapp-tag"
            placeholder="$YourCashTag"
             color="#00D632"
          />
          <MinDepositCard method="cashapp" label="CashApp" color="#00D632" />
          <FeeSettingCard method="cashapp" label="CashApp" color="#00D632" />
        </div>
      </div>

      {/* Manual Payment Handles — Venmo / Zelle / Chime */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">Alternative Payment Handles</p>
        <div className="space-y-3">
          <HandleSettingCard
            label="Venmo Handle"
            description="Username or phone number customers send Venmo payments to."
            settingKey="venmo-handle"
            placeholder="@YourVenmo"
            color="#3D95CE"
          />
          <MinDepositCard method="venmo" label="Venmo" color="#3D95CE" />
          <HandleSettingCard
            label="Zelle Handle"
            description="Phone number or email customers send Zelle payments to."
            settingKey="zelle-handle"
            placeholder="+1 (555) 000-0000 or email"
            color="#9B59E8"
          />
          <MinDepositCard method="zelle" label="Zelle" color="#9B59E8" />
          <FeeSettingCard method="zelle" label="Zelle" color="#9B59E8" />
          <HandleSettingCard
            label="Chime Handle"
            description="Phone number or email customers send Chime payments to."
            settingKey="chime-handle"
            placeholder="+1 (555) 000-0000"
            color="#00D632"
          />
          <MinDepositCard method="chime" label="Chime" color="#00D632" />
          <FeeSettingCard method="chime" label="Chime" color="#00D632" />
        </div>
      </div>

      {/* Crypto min deposit */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">Crypto Settings</p>
        <MinDepositCard method="crypto" label="Crypto" color="#F7931A" />
      </div>

      {/* Telegram Bot Token Status */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">Telegram Bot Token</p>
        {statusLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <Card className="bg-[#111] border-white/10" data-testid="card-integration-TELEGRAM_BOT_TOKEN">
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="font-mono text-sm text-white">TELEGRAM_BOT_TOKEN</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Required for Telegram Stars payments. Create a bot via @BotFather and enable Stars in Payments.</p>
              </div>
              <div className="shrink-0 mt-0.5">
                {integrationStatus?.TELEGRAM_BOT_TOKEN ? (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">✓ Set</Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">⚠ Not set</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-[#111] border-primary/20">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-primary">How to set the Telegram token</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Message <span className="text-white font-medium">@BotFather</span> on Telegram and create a new bot</li>
            <li>Go to <span className="text-white font-medium">My Bots → Your Bot → Payments</span> and enable Stars</li>
            <li>Add the token as a secret named <span className="text-white font-mono">TELEGRAM_BOT_TOKEN</span> in Replit's Secrets panel (🔒)</li>
            <li>Restart the server — webhook registers automatically</li>
          </ol>
        </CardContent>
      </Card>

      {/* Feature Visibility Toggles */}
      <FeatureTogglesCard />
    </div>
  );
}

function FeatureTogglesCard() {
  const { toast } = useToast();
  const { data: features, isLoading: featuresLoading } = useQuery<{ checker: boolean; reseller: boolean; ranks: boolean; logs: boolean; cards: boolean; plinko: boolean }>({
    queryKey: ["/api/settings/features"],
  });

  const toggleFeature = useMutation({
    mutationFn: async (body: { checker?: boolean; reseller?: boolean; ranks?: boolean; logs?: boolean; cards?: boolean; plinko?: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/settings/features", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/features"] });
      toast({ title: "Feature updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const FEATURES = [
    { key: "ranks" as const, label: "Ranks", desc: "Show/hide the Ranks page and nav link" },
    { key: "logs" as const, label: "Logs Shop", desc: "Show/hide the Logs shop page and nav link" },
    { key: "cards" as const, label: "Cards", desc: "Show/hide the Cards page and nav link" },
    { key: "plinko" as const, label: "Plinko", desc: "Show/hide the Plinko game and nav link" },
    { key: "checker" as const, label: "Card Checker", desc: "Show/hide the Checker page and nav link" },
    { key: "reseller" as const, label: "Become Reseller", desc: "Show/hide the Reseller application page" },
  ];

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-3">Feature Visibility</p>
      <div className="space-y-2">
        {featuresLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
        ) : FEATURES.map((f) => {
          const enabled = features?.[f.key] !== false;
          return (
            <Card key={f.key} className="bg-[#111] border-white/10" data-testid={`card-feature-${f.key}`}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-white">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{enabled ? "Visible to users" : "Hidden — nobody can see it"}</p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={toggleFeature.isPending}
                  onCheckedChange={(val) => toggleFeature.mutate({ [f.key]: val })}
                  data-testid={`switch-feature-${f.key}`}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function methodMeta(method: string) {
  if (method === "Venmo") return { color: "#3D95CE", label: "Venmo", icon: "V" };
  if (method === "Chime") return { color: "#00D632", label: "Chime", icon: "C" };
  if (method === "Zelle") return { color: "#9B59E8", label: "Zelle", icon: "Z" };
  return { color: "#00D632", label: "CashApp", icon: "$" };
}

function CashAppSection() {
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | "CashApp" | "Venmo" | "Chime" | "Zelle">("all");

  const { data: allOrders, isLoading } = useQuery({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 6000,
  });

  const manualOrders = (allOrders || []).filter((o: any) => ["CashApp", "Venmo", "Chime", "Zelle"].includes(o.paymentMethod));
  const pendingOrders = manualOrders.filter((o: any) => o.status === "pending");
  const cq = searchQuery.trim().toLowerCase();
  const typeFiltered = (showHistory ? manualOrders : pendingOrders).filter((o: any) =>
    paymentTypeFilter === "all" || o.paymentMethod === paymentTypeFilter
  );
  const displayedOrders = typeFiltered.filter((o: any) =>
    !cq ||
    o.orderId?.toLowerCase().includes(cq) ||
    o.user?.username?.toLowerCase().includes(cq) ||
    o.paymentNote?.toLowerCase().includes(cq)
  );

  const cashappCount = pendingOrders.filter((o: any) => o.paymentMethod === "CashApp").length;
  const venmoCount = pendingOrders.filter((o: any) => o.paymentMethod === "Venmo").length;
  const chimeCount = pendingOrders.filter((o: any) => o.paymentMethod === "Chime").length;
  const zelleCount = pendingOrders.filter((o: any) => o.paymentMethod === "Zelle").length;

  const fulfillMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/admin/orders/${orderId}/cashapp-fulfill`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      setSelectedOrder(null);
      toast({ title: "Deposit confirmed — balance credited" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markUnpaidMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("POST", `/api/admin/orders/${orderId}/mark-unpaid`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      setSelectedOrder(null);
      toast({ title: "Marked unpaid" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  if (selectedOrder) {
    const current = manualOrders?.find((o: any) => o.id === selectedOrder.id) || selectedOrder;
    const meta = methodMeta(current.paymentMethod);
    const productItems = current.items?.filter((i: any) => !i.itemType || i.itemType === "product") || [];
    const grouped: Record<string, { productName: string; variantName: string; qty: number; unitPrice: number }> = {};
    for (const item of productItems) {
      const key = String(item.variantId || item.id);
      if (!grouped[key]) grouped[key] = { productName: item.productName || "Product", variantName: item.variant?.name || "—", qty: 0, unitPrice: item.price };
      grouped[key].qty += (item.quantity ?? 1);
    }
    const groupedEntries = Object.entries(grouped);
    const isPending = current.status === "pending";

    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>← Back</Button>
        <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: meta.color }}>
                {meta.icon}
              </div>
              <h2 className="text-lg font-black text-white">{meta.label} Deposit</h2>
            </div>
            <Badge className={statusBadgeClass(current.status)}>{statusLabel(current.status)}</Badge>
          </div>

          <div className="space-y-3 border-b border-white/10 pb-4">
            <div><p className="text-[10px] text-white/45 mb-0.5">Customer</p><p className="text-xs text-white font-bold">{current.user?.username || current.userId}</p></div>
            <div><p className="text-[10px] text-white/45 mb-0.5">Date</p><p className="text-xs text-white/70">{formatDateTime(current.createdAt)}</p></div>
            {current.paymentNote && (
              <div>
                <p className="text-[10px] text-white/45 mb-0.5">Payment Note</p>
                <p className="text-xs font-mono font-bold" style={{ color: meta.color }}>{current.paymentNote}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-white/45 mb-0.5">Amount to receive</p>
              <p className="text-2xl font-black text-white">${(current.total / 100).toFixed(2)}</p>
              <p className="text-[10px] text-white/40 font-mono mt-0.5">user specified this amount — confirm only if received exactly this</p>
            </div>
          </div>

          {isPending && (
            <div className="flex gap-3">
              <button
                onClick={() => fulfillMutation.mutate(current.id)}
                disabled={fulfillMutation.isPending}
                className="flex-1 h-11 rounded-xl text-white text-sm font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: `${meta.color}30`, border: `1px solid ${meta.color}60` }}
                data-testid={`button-cashapp-paid-${current.id}`}
              >
                {fulfillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>✓ Confirm Received</>}
              </button>
              <button
                onClick={() => markUnpaidMutation.mutate(current.id)}
                disabled={markUnpaidMutation.isPending}
                className="flex-1 h-11 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-black hover:bg-red-500/20 transition-colors disabled:opacity-50"
                data-testid={`button-cashapp-unpaid-${current.id}`}
              >
                ✕ Reject
              </button>
            </div>
          )}

          {groupedEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/45">Items Ordered</p>
              {groupedEntries.map(([key, g]) => (
                <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#0d0d0d] border border-white/10">
                  <div>
                    <p className="text-xs font-bold text-white">{g.productName}</p>
                    <p className="text-[10px] text-white/45 mt-0.5">{g.variantName} · qty {g.qty}</p>
                  </div>
                  <p className="text-xs text-white/60">${((g.unitPrice * g.qty) / 100).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{showHistory ? "Payment History" : "Pending Payments"}</h1>
          {pendingOrders.length > 0 && (
            <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">{pendingOrders.length} pending</Badge>
          )}
        </div>
        <button
          onClick={() => setShowHistory(h => !h)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showHistory ? "bg-primary text-white" : "bg-[#0d0d0d] text-white/45 hover:bg-white/5"}`}
        >
          {showHistory ? "← Pending" : "History"}
        </button>
      </div>

      {/* Payment type filter */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "all", label: "All", count: pendingOrders.length, color: "text-white/70" },
          { key: "CashApp", label: "CashApp", count: cashappCount, color: "text-[#00D632]" },
          { key: "Venmo", label: "Venmo", count: venmoCount, color: "text-[#3D95CE]" },
          { key: "Chime", label: "Chime", count: chimeCount, color: "text-[#00D632]" },
          { key: "Zelle", label: "Zelle", count: zelleCount, color: "text-[#9B59E8]" },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => setPaymentTypeFilter(key as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              paymentTypeFilter === key
                ? "bg-white/10 border-white/20 text-white"
                : "bg-transparent border-white/8 text-white/40 hover:border-white/15 hover:text-white/60"
            }`}
          >
            <span>{label}</span>
            {!showHistory && count > 0 && (
              <span className={`text-[10px] font-mono ${paymentTypeFilter === key ? "text-white/70" : color}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Search by order ID, username, payment note..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full h-9 bg-[#0d0d0d] border border-white/10 rounded-lg px-3 pr-8 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
          data-testid="input-cashapp-order-search"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {displayedOrders.length === 0 ? (
        <div className="text-center py-20 text-white/30 text-sm">
          {showHistory ? "No manual payment history" : "No pending deposits"}
        </div>
      ) : (
        <div className="space-y-2">
          {displayedOrders.map((order: any) => {
            const meta = methodMeta(order.paymentMethod);
            return (
              <div
                key={order.id}
                className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#111]/[0.03] transition-colors"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0" style={{ background: `${meta.color}30`, border: `1px solid ${meta.color}50`, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
                      <Badge className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</Badge>
                    </div>
                    <p className="text-sm font-black text-white">${(order.total / 100).toFixed(2)}</p>
                    {order.paymentNote && <p className="text-[10px] font-mono mt-0.5" style={{ color: `${meta.color}80` }}>{order.paymentNote}</p>}
                    <p className="text-[10px] text-white/40">{order.user?.username || order.userId} · {formatDate(order.createdAt)}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function findCardNumberPreview(line: string): string {
  if (!line) return "";
  const tokens = line.split(/[|\t:;,\s]+/).map(t => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const digits = token.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && /^[3456]/.test(digits)) return digits;
  }
  const noGaps = line.replace(/[\s\-]/g, "");
  const m = noGaps.match(/[3456]\d{12,18}/);
  if (m) return m[0];
  return "";
}

function extractZipPreview(line: string): string {
  if (!line) return "";
  const tokens = line.split(/[|\t:;,\s]+/).map(t => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const zipMatch = token.match(/^(\d{5})(?:-\d{4})?$/);
    if (zipMatch) {
      const num = parseInt(zipMatch[1], 10);
      if (num >= 501 && num <= 99950 && !(num >= 1900 && num <= 2100)) return zipMatch[1];
    }
  }
  for (const token of tokens) {
    const digits = token.replace(/\D/g, "");
    if (digits.length >= 13) continue;
    const m = token.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= 501 && num <= 99950 && !(num >= 1900 && num <= 2100)) return m[1];
    }
  }
  return "";
}

function extractStatePreview(line: string): string {
  const states = new Set([
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
    "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
    "VA", "WA", "WV", "WI", "WY", "DC",
  ]);
  const tokens = line.split(/[|\t:;,]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
  return tokens.find(token => states.has(token)) ?? "";
}

function countryFlagPreview(code: string): string {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...code.toUpperCase().split("").map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

function AdminBasesTab() {
  const { toast } = useToast();
  const qc = queryClient;
  const [newBaseName, setNewBaseName] = useState("");
  const [newBaseRefundable, setNewBaseRefundable] = useState(false);
  const [rateDrafts, setRateDrafts] = useState<Record<number, string>>({});
  const [expandedBase, setExpandedBase] = useState<number | null>(null);
  const [editingBaseId, setEditingBaseId] = useState<number | null>(null);
  const [editingBaseName, setEditingBaseName] = useState("");

  const { data: bases, isLoading } = useQuery<any[]>({ queryKey: ["/api/card-bases"], refetchInterval: 5000 });
  const { data: baseCards } = useQuery<any[]>({
    queryKey: ["/api/admin/card-bases", expandedBase, "cards"],
    queryFn: async () => {
      if (!expandedBase) return [];
      const res = await fetch(`/api/admin/card-bases/${expandedBase}/cards`, { credentials: "include" });
      return res.json();
    },
    enabled: !!expandedBase,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newBaseName.trim()) throw new Error("Name required");
      const res = await apiRequest("POST", "/api/admin/card-bases", {
        name: newBaseName.trim(),
        refundable: newBaseRefundable,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/card-bases"] });
      setNewBaseName("");
      setNewBaseRefundable(false);
      toast({ title: "Base created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/card-bases/${id}`, { name });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/card-bases"] });
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      setEditingBaseId(null);
      setEditingBaseName("");
      toast({ title: "Base renamed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refundableMutation = useMutation({
    mutationFn: async ({ id, name, refundable }: { id: number; name: string; refundable: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/card-bases/${id}`, { name, refundable });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/card-bases"] });
      toast({ title: "Refundability updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rateMutation = useMutation({
    mutationFn: async ({ id, name, refundable, hrPercent }: { id: number; name: string; refundable: boolean; hrPercent: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/card-bases/${id}`, { name, refundable, hrPercent });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to update valid rate"); }
      return res.json();
    },
    onSuccess: (updated: any) => {
      setRateDrafts(drafts => ({ ...drafts, [updated.id]: String(updated.hrPercent) }));
      qc.invalidateQueries({ queryKey: ["/api/card-bases"] });
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Base valid rate updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/card-bases/${id}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/card-bases"] }); if (expandedBase) setExpandedBase(null); toast({ title: "Base deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: number) => { await apiRequest("DELETE", `/api/admin/cards/${cardId}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/card-bases"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/card-bases", expandedBase, "cards"] });
      toast({ title: "Card removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Create base */}
      <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-white/45 uppercase tracking-widest">Create Base</p>
        <div className="flex gap-2">
          <Input
            value={newBaseName}
            onChange={e => setNewBaseName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newBaseName.trim()) createMutation.mutate(); }}
            placeholder="Base name (e.g. OG CLOVER)"
            className="bg-[#111]/5 border-white/10 text-sm flex-1"
            data-testid="input-base-name"
          />
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={newBaseRefundable}
              onChange={e => setNewBaseRefundable(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
              data-testid="checkbox-base-refundable"
            />
            Refundable base
          </label>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newBaseName.trim()} size="sm" className="h-9" data-testid="btn-create-base">
            {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </Button>
        </div>
      </div>

      {/* Bases list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (bases ?? []).length === 0 ? (
          <p className="text-xs text-white/40 text-center py-6">No bases yet</p>
        ) : (
          (bases ?? []).map((b: any) => (
            <div key={b.id} className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {editingBaseId === b.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingBaseName}
                        onChange={e => setEditingBaseName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && editingBaseName.trim()) renameMutation.mutate({ id: b.id, name: editingBaseName });
                          if (e.key === "Escape") { setEditingBaseId(null); setEditingBaseName(""); }
                        }}
                        className="bg-[#111]/5 border-white/10 h-7 text-xs font-mono flex-1"
                        autoFocus
                        data-testid={`input-rename-base-${b.id}`}
                      />
                      <button
                        onClick={() => { if (editingBaseName.trim()) renameMutation.mutate({ id: b.id, name: editingBaseName }); }}
                        disabled={renameMutation.isPending || !editingBaseName.trim()}
                        className="text-[10px] font-mono px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
                        data-testid={`btn-save-rename-base-${b.id}`}
                      >
                        {renameMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "save"}
                      </button>
                      <button
                        onClick={() => { setEditingBaseId(null); setEditingBaseName(""); }}
                        className="text-[10px] font-mono px-2 py-1 rounded border border-white/10 text-white/45 hover:text-white transition-all"
                      >
                        cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setExpandedBase(expandedBase === b.id ? null : b.id)}
                      className="text-left w-full"
                      data-testid={`btn-expand-base-${b.id}`}
                    >
                       <div className="flex items-center gap-2">
                         <p className="text-sm font-bold text-white font-mono">{b.name}</p>
                         {b.refundable && <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[9px]">REFUNDABLE</Badge>}
                       </div>
                       <p className="text-[10px] text-white/40">{b.count} card{b.count !== 1 ? "s" : ""} in stock · {b.hrPercent ?? 80}% valid rate · ${((b.profit ?? 0) / 100).toFixed(2)} profit</p>
                    </button>
                  )}
                </div>
                {editingBaseId !== b.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-white/40 uppercase tracking-wider">rate</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={rateDrafts[b.id] ?? String(b.hrPercent ?? 80)}
                        onChange={e => setRateDrafts(drafts => ({ ...drafts, [b.id]: e.target.value }))}
                        className="w-14 h-7 bg-[#111]/5 border-white/10 text-[10px] font-mono px-1.5"
                        data-testid={`input-base-valid-rate-${b.id}`}
                      />
                      <span className="text-[10px] text-white/45">%</span>
                      <button
                        onClick={() => rateMutation.mutate({ id: b.id, name: b.name, refundable: Boolean(b.refundable), hrPercent: Number(rateDrafts[b.id] ?? b.hrPercent ?? 80) })}
                        disabled={rateMutation.isPending}
                        className="text-[9px] font-mono px-1.5 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
                        data-testid={`btn-save-base-valid-rate-${b.id}`}
                      >
                        save
                      </button>
                    </div>
                    <button
                      onClick={() => { setEditingBaseId(b.id); setEditingBaseName(b.name); setExpandedBase(null); }}
                      className="text-[10px] font-mono px-2 py-1 rounded border border-white/10 text-white/45 hover:border-white/25 hover:text-white transition-all"
                      data-testid={`btn-rename-base-${b.id}`}
                    >
                      rename
                    </button>
                    <button
                      onClick={() => refundableMutation.mutate({ id: b.id, name: b.name, refundable: !b.refundable })}
                      disabled={refundableMutation.isPending}
                      className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${b.refundable ? "border-green-500/30 text-green-400 hover:bg-green-500/10" : "border-white/10 text-white/45 hover:border-white/20"}`}
                      data-testid={`btn-toggle-refundable-${b.id}`}
                    >
                      {b.refundable ? "refundable" : "not refundable"}
                    </button>
                    <button
                      onClick={() => setExpandedBase(expandedBase === b.id ? null : b.id)}
                      className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${expandedBase === b.id ? "border-primary/40 text-primary" : "border-white/10 text-white/45 hover:border-white/20"}`}
                      data-testid={`btn-view-base-${b.id}`}
                    >
                      {expandedBase === b.id ? "close" : "view"}
                    </button>
                    <button
                      onClick={() => { if (b.count > 0) { toast({ title: "Cannot delete", description: "Remove all cards first", variant: "destructive" }); return; } deleteMutation.mutate(b.id); }}
                      disabled={deleteMutation.isPending}
                      className="text-white/30 hover:text-destructive transition-colors"
                      data-testid={`btn-delete-base-${b.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {expandedBase === b.id && (
                <div className="border-t border-white/10 px-4 py-3 space-y-2">
                  {!baseCards || baseCards.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-3">No cards in this base</p>
                  ) : (
                    baseCards.map((card: any) => {
                      const bin = (card.cardNumber || "").replace(/\D/g, "").substring(0, 6);
                      const zip = extractZipPreview(card.extras ?? "");
                      return (
                        <div key={card.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono bg-[#111]/5 border border-white/10 px-1.5 py-0.5 rounded text-white/45">{bin}</span>
                              {zip && <span className="text-[10px] text-white/40 font-mono">ZIP {zip}</span>}
                              <span className="text-[10px] text-white/40">{b.hrPercent ?? 80}% valid rate</span>
                            </div>
                            {card.extras && <p className="text-[9px] text-white/30 font-mono truncate">{card.extras.substring(0, 55)}...</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="font-mono text-xs text-white/60">${(card.price / 100).toFixed(2)}</span>
                            <button
                              onClick={() => deleteCardMutation.mutate(card.id)}
                              disabled={deleteCardMutation.isPending}
                              className="text-white/30 hover:text-destructive transition-colors"
                              data-testid={`btn-delete-base-card-${card.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AdminCardsSection() {
  const { toast } = useToast();
  const qc = queryClient;
  const [tab, setTab] = useState<"stock" | "bases">("stock");
  const [fullItem, setFullItem] = useState("");
  const [price, setPrice] = useState("");
  const [selectedBaseId, setSelectedBaseId] = useState<string>("");

  const { data: cards, isLoading } = useQuery<any[]>({ queryKey: ["/api/cards"] });
  const { data: bases } = useQuery<any[]>({ queryKey: ["/api/card-bases"] });

  // Auto-extract BIN + ZIP preview from first card entry
  const cardEntries = fullItem.split(/\r?\n/).map(e => e.trim()).filter(Boolean);
  const previewBin = findCardNumberPreview(cardEntries[0] || "").substring(0, 6);
  const previewZip = extractZipPreview(cardEntries[0] || "");

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!fullItem.trim()) throw new Error("Full item is required");
      if (!price || parseFloat(price) <= 0) throw new Error("Valid price is required");
      if (!selectedBaseId) throw new Error("Base is required");
      const body: any = { extras: fullItem.trim(), price: parseFloat(price), baseId: Number(selectedBaseId) };
      const res = await apiRequest("POST", "/api/cards", body);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to add card"); }
      return res.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/card-bases"] });
      setFullItem(""); setPrice(""); setSelectedBaseId("");
      const count = data?.count ?? 1;
      toast({ title: count > 1 ? `${count} cards added` : "Card added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/cards/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cards"] }); qc.invalidateQueries({ queryKey: ["/api/card-bases"] }); toast({ title: "Card deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold text-white">Cards</h2>

      {/* Add Card form */}
      <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-white/45 uppercase tracking-widest">Add Card</p>

        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Full Delivery Item</label>
          <textarea
            value={fullItem}
            onChange={e => setFullItem(e.target.value)}
            placeholder={"4111111111111111|12/25|123|John Doe|123 Main St|City|12345\n4222222222222222|12/26|456|Jane Doe|456 Oak Ave|City|54321"}
            rows={5}
            className="w-full bg-[#111]/5 border border-white/10 rounded text-xs text-white font-mono p-2 outline-none focus:border-gray-300 resize-none placeholder:text-white/30"
            data-testid="input-full-item"
          />
          <p className="text-[10px] text-white/30">Paste one card per line. Blank lines are ignored.</p>
          <div className="flex gap-3">
            {cardEntries.length > 1 && (
              <p className="text-[10px] text-white/50 font-mono">{cardEntries.length} cards detected</p>
            )}
            {previewBin.length === 6 && (
              <p className="text-[10px] text-primary/60 font-mono">BIN: {previewBin}</p>
            )}
            {previewZip && (
              <p className="text-[10px] text-red-400/60 font-mono">ZIP: {previewZip}</p>
            )}
          </div>
        </div>

        {/* Base selector — required */}
        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Base <span className="text-red-400/70">*</span></label>
          <select
            value={selectedBaseId}
            onChange={e => setSelectedBaseId(e.target.value)}
            className="w-full bg-[#111]/5 border border-white/10 rounded text-xs text-white py-2 px-2 outline-none focus:border-gray-300"
            data-testid="select-card-base"
          >
            <option value="">— Select base —</option>
            {(bases ?? []).map((b: any) => (
               <option key={b.id} value={String(b.id)}>
                 {b.name}{b.refundable ? " · refundable" : ""}
               </option>
            ))}
          </select>
           {selectedBaseId && (() => {
             const selectedBase = (bases ?? []).find((b: any) => String(b.id) === selectedBaseId);
             return selectedBase ? (
               <p className={`text-[10px] font-mono ${selectedBase.refundable ? "text-green-400/75" : "text-white/35"}`}>
                 {selectedBase.refundable ? "✓ Refundable base" : "Not refundable"}
               </p>
             ) : null;
           })()}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Price ($)</label>
          <Input
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="5.00"
            type="number"
            step="0.01"
            className="bg-[#111]/5 border-white/10"
            data-testid="input-card-price"
          />
        </div>

        <Button
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || !fullItem.trim() || !price || !selectedBaseId}
          size="sm"
          className="w-full h-8 text-xs"
          data-testid="btn-add-card"
        >
          {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : cardEntries.length > 1 ? `Add ${cardEntries.length} Cards` : "Add Card"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(["stock", "bases"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-mono transition-all capitalize ${tab === t ? "text-primary border-b border-primary -mb-px" : "text-white/40 hover:text-white/70"}`}
            data-testid={`tab-cards-${t}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <div className="space-y-2">
          <p className="text-xs text-white/40">{(cards ?? []).length} cards in stock</p>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            (cards ?? []).map((card: any) => {
              const cBin = (card.cardNumber || "").replace(/\D/g, "").substring(0, 6);
              const zip = extractZipPreview(card.extras ?? "");
               const state = extractStatePreview(card.extras ?? "");
               const countryCode = card.binData?.countryCode ?? "";
               const country = card.binData?.country ?? card.country ?? "Unknown";
               const base = (bases ?? []).find((b: any) => b.id === card.baseId);
              return (
                 <div key={card.id} className="overflow-x-auto bg-[#111] border border-white/10 rounded-xl">
                   <div className="min-w-[620px]">
                     <div className="grid grid-cols-[0.8fr_0.8fr_1.1fr_1.2fr_0.8fr_0.8fr] gap-3 px-4 py-2 border-b border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/35">
                       <span>State</span>
                       <span>ZIP</span>
                       <span>Country</span>
                       <span>Base</span>
                       <span>Base rate</span>
                       <span>Refundable</span>
                     </div>
                     <div className="grid grid-cols-[0.8fr_0.8fr_1.1fr_1.2fr_0.8fr_0.8fr] gap-3 items-center px-4 py-3">
                       <span className="text-xs font-mono text-white/70">{state || "—"}</span>
                       <span className="text-xs font-mono text-white/55">{zip || "—"}</span>
                       <span className="flex items-center gap-1.5 text-xs text-white/65 truncate" title={country}>
                         <span className="text-base leading-none">{countryFlagPreview(countryCode)}</span>
                         {countryCode || country}
                       </span>
                       <span className="text-xs font-mono text-primary/75 truncate">{card.baseName || "—"}</span>
                        <span className="text-xs font-mono text-primary/75">{base?.hrPercent ?? 80}%</span>
                       <span className={base?.refundable ? "text-green-400 text-lg" : "text-white/25"}>{base?.refundable ? "✓" : "—"}</span>
                     </div>
                     <div className="flex items-center justify-between gap-3 px-4 pb-3">
                       <p className="text-[9px] text-white/30 truncate font-mono">{card.extras || "No item details"}</p>
                       <div className="flex items-center gap-3 shrink-0">
                         <span className="font-mono text-sm text-white">${(card.price / 100).toFixed(2)}</span>
                         <button
                           onClick={() => deleteMutation.mutate(card.id)}
                           disabled={deleteMutation.isPending}
                           className="text-white/30 hover:text-destructive transition-colors"
                           data-testid={`btn-delete-card-${card.id}`}
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       </div>
                     </div>
                   </div>
                 </div>
              );
            })
          )}
        </div>
      )}

      {tab === "bases" && <AdminBasesTab />}
    </div>
  );
}

function AdminAchSection() {
  const { toast } = useToast();
  const qc = queryClient;
  const [bankName, setBankName] = useState("");
  const [balance, setBalance] = useState("");
  const [fullItem, setFullItem] = useState("");
  const [price, setPrice] = useState("");

  const { data: achList, isLoading } = useQuery<any[]>({ queryKey: ["/api/ach"] });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ach", { bankName, balance, fullItem, price });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ach"] });
      setBankName(""); setBalance(""); setFullItem(""); setPrice("");
      toast({ title: "ACH added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/ach/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ach"] });
      toast({ title: "ACH deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold text-white">ACH Management</h2>

      <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-white/45 uppercase tracking-widest">Add ACH</p>

        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Bank</label>
          <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Chase, Wells Fargo..." className="bg-[#111]/5 border-white/10" data-testid="input-ach-bank" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Balance</label>
          <div className="flex items-center bg-[#111]/5 border border-white/10 rounded-md overflow-hidden">
            <span className="pl-3 pr-1 text-sm text-white/45 font-mono select-none">$</span>
            <input
              value={balance}
              onChange={e => setBalance(e.target.value.replace(/[^0-9,.\-]/g, ""))}
              placeholder="4,990 or 3,298.09"
              type="text"
              inputMode="decimal"
              className="flex-1 bg-transparent py-2 pr-3 text-sm text-white font-mono outline-none placeholder:text-white/30"
              data-testid="input-ach-balance"
            />
          </div>
          <p className="text-[10px] text-white/40">e.g. 4,990 or 3,298.09 — $ is added automatically</p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Full Item</label>
          <textarea
            value={fullItem}
            onChange={e => setFullItem(e.target.value)}
            placeholder={"routing|account|name|address"}
            rows={3}
            className="w-full bg-[#111]/5 border border-white/10 rounded text-xs text-white font-mono p-2 outline-none focus:border-gray-300 resize-none placeholder:text-white/30"
            data-testid="input-ach-full-item"
          />
          <p className="text-[9px] text-white/30">only shown to buyer after purchase</p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Price ($)</label>
          <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="10.00" type="number" step="0.01" className="bg-[#111]/5 border-white/10" data-testid="input-ach-price" />
        </div>

        <Button
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || !bankName || !balance || !fullItem || !price}
          size="sm"
          className="w-full h-8 text-xs"
          data-testid="btn-add-ach"
        >
          {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add ACH"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-white/40">{(achList ?? []).length} ACH total</p>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          (achList ?? []).map((a: any) => (
            <div key={a.id} className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{a.bankName}</p>
                <p className="text-[10px] text-white/40 font-mono">{a.balance}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="font-mono text-sm text-white">${(a.price / 100).toFixed(2)}</span>
                <button
                  onClick={() => deleteMutation.mutate(a.id)}
                  disabled={deleteMutation.isPending}
                  className="text-white/30 hover:text-destructive transition-colors"
                  data-testid={`btn-delete-ach-${a.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


function SmtpSection() {
  const { toast } = useToast();
  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState("587");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loaded, setLoaded] = useState(false);

  const { data: smtpData, isLoading } = useQuery({
    queryKey: ["/api/admin/smtp"],
    queryFn: async () => {
      const res = await fetch("/api/admin/smtp");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (smtpData && !loaded) {
    setHost(smtpData.smtp_host || "smtp.gmail.com");
    setPort(smtpData.smtp_port || "587");
    setEmail(smtpData.smtp_email || "");
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: any = { smtp_host: host, smtp_port: port, smtp_email: email };
      if (password) body.smtp_password = password;
      const res = await apiRequest("POST", "/api/admin/smtp", body);
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SMTP settings saved!" });
      setPassword("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Email (SMTP)</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure the sending email for the Email Bomber tool</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4 max-w-md">
          <div className="space-y-1">
            <label className="text-[10px] text-white/45 uppercase tracking-widest">SMTP Host</label>
            <Input
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="bg-[#111]/5 border-white/10"
              data-testid="input-smtp-host"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-white/45 uppercase tracking-widest">SMTP Port</label>
            <Input
              value={port}
              onChange={e => setPort(e.target.value)}
              placeholder="587"
              className="bg-[#111]/5 border-white/10"
              data-testid="input-smtp-port"
            />
            <p className="text-[10px] text-white/30">587 for TLS, 465 for SSL, 25 for plain</p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-white/45 uppercase tracking-widest">Sender Email</label>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="youremail@gmail.com"
              type="email"
              className="bg-[#111]/5 border-white/10"
              data-testid="input-smtp-email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-white/45 uppercase tracking-widest">
              App Password {smtpData?.has_password && <span className="text-red-400 normal-case">(saved)</span>}
            </label>
            <Input
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={smtpData?.has_password ? "Leave blank to keep current password" : "App password or SMTP password"}
              type="password"
              className="bg-[#111]/5 border-white/10"
              data-testid="input-smtp-password"
            />
            <p className="text-[10px] text-white/30">For Gmail: use an App Password, not your account password</p>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !host || !port || !email}
            className="w-full h-9 text-xs"
            data-testid="btn-save-smtp"
          >
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save SMTP Settings"}
          </Button>
        </div>
      )}
    </div>
  );
}

function SellersSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const { data: sellers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/seller-applications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/seller-applications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/seller-applications/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Seller approved" });
      qc.invalidateQueries({ queryKey: ["/api/admin/seller-applications"] });
      setSelected(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await apiRequest("POST", `/api/admin/seller-applications/${id}/reject`, { note });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Application rejected" });
      qc.invalidateQueries({ queryKey: ["/api/admin/seller-applications"] });
      setSelected(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = (sellers || []).filter((s: any) => filter === "all" || s.status === filter);
  const pendingCount = (sellers || []).filter((s: any) => s.status === "pending").length;

  function statusBadge(status: string) {
    if (status === "approved") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-mono">approved</span>;
    if (status === "pending") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-mono">pending</span>;
    if (status === "rejected") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-mono">rejected</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d0d0d] text-white/45 font-mono">{status}</span>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sellers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage seller applications</p>
        </div>
        {pendingCount > 0 && (
          <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded-full font-mono">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="flex gap-1 flex-wrap">
        {(["pending", "all", "approved", "rejected"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-[#0d0d0d] text-white/45 hover:bg-[#111]/5 hover:text-white/70"}`}
          >
            {f}{f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">No {filter === "all" ? "" : filter} applications</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((seller: any) => (
            <div
              key={seller.id}
              onClick={() => { setSelected(seller); setNoteInput(""); }}
              className="flex items-center gap-3 p-3 rounded-xl bg-[#111]/3 border border-white/10 hover:bg-[#0d0d0d] hover:border-white/10 cursor-pointer transition-colors"
              data-testid={`row-seller-${seller.id}`}
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{(seller.username || "?")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{seller.username ?? "Unknown"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{seller.note ? seller.note.slice(0, 60) : "No note"}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {statusBadge(seller.status)}
                 <span className="text-[10px] text-white/40">{formatDate(seller.createdAt, { month: "short", day: "numeric" })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-base font-bold">Seller Application</h2>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-[#0d0d0d] text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-white/45 mb-0.5">Username</p>
                  <p className="text-sm text-white font-mono">{selected.username ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/45 mb-0.5">Status</p>
                  {statusBadge(selected.status)}
                </div>
                {selected.sellerCode && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-white/45 mb-0.5">Seller Code</p>
                    <p className="text-sm text-primary font-mono font-bold">{selected.sellerCode}</p>
                  </div>
                )}
                {selected.note && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-white/45 mb-0.5">Applicant Note</p>
                    <p className="text-xs text-white/60 leading-relaxed">{selected.note}</p>
                  </div>
                )}
              </div>

              {selected.status === "pending" && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <p className="text-[10px] text-white/45 uppercase tracking-widest">Approve or Reject</p>
                  <Input
                    placeholder="Rejection reason (optional)"
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    className="bg-[#111]/5 border-white/10 text-xs h-8"
                    data-testid="input-seller-note"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => approveMutation.mutate(selected.id)}
                      disabled={approveMutation.isPending}
                      data-testid="btn-seller-approve"
                    >
                      {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-8 text-xs"
                      onClick={() => rejectMutation.mutate({ id: selected.id, note: noteInput })}
                      disabled={rejectMutation.isPending}
                      data-testid="btn-seller-reject"
                    >
                      {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject"}
                    </Button>
                  </div>
                </div>
              )}

              {selected.status === "approved" && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full h-8 text-xs opacity-80"
                    onClick={() => rejectMutation.mutate({ id: selected.id, note: "Access revoked by admin" })}
                    disabled={rejectMutation.isPending}
                    data-testid="btn-seller-revoke"
                  >
                    {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Revoke Seller Access"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SUPPORT SECTION
══════════════════════════════════════════════ */
function SupportSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionTicketId, setActionTicketId] = useState<number | null>(null);
  const [adminMessage, setAdminMessage] = useState("");

  const { data: tickets, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/support"],
    staleTime: 10000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/support/${id}`, { action, message: adminMessage });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/support"] });
      setActionTicketId(null);
      setAdminMessage("");
      toast({ title: "Ticket updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusCls = (s: string) => {
    if (s === "open")     return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
    if (s === "refunded") return "bg-red-500/15  text-red-400  border-red-500/20";
    if (s === "replaced") return "bg-blue-500/15   text-blue-400   border-blue-500/20";
    return "bg-white/8 text-white/40 border-white/10";
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const open   = (tickets ?? []).filter((t: any) => t.status === "open");
  const closed = (tickets ?? []).filter((t: any) => t.status !== "open");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-sm font-semibold text-white mb-0.5">Support Tickets</p>
        <p className="text-xs text-white/40">{open.length} open · {closed.length} closed</p>
      </div>

      {(tickets ?? []).length === 0 && (
        <div className="text-center py-16 text-white/30 text-sm">No tickets yet</div>
      )}

      {(tickets ?? []).map((ticket: any) => (
        <Card key={ticket.id} className="bg-[#111] border-white/10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusCls(ticket.status)}`}>
                    {ticket.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-white/50 font-mono">#{ticket.id}</span>
                </div>
                <p className="text-xs text-white/40 font-mono">Order: {ticket.orderId}</p>
              </div>
              <p className="text-[10px] text-white/30 shrink-0">{formatDate(ticket.createdAt)}</p>
            </div>

            <div className="bg-white/[0.03] rounded p-3 space-y-1.5 border border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-white/30">Issue</span>
                <span className="text-xs font-semibold text-white">{ticket.subject}</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{ticket.description}</p>
              {ticket.imageUrl && (
                <a href={ticket.imageUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline block">View attached image →</a>
              )}
            </div>

            {ticket.adminMessage && (
              <div className="bg-primary/5 border border-primary/15 rounded px-3 py-2">
                <p className="text-[10px] text-primary/60 uppercase tracking-widest mb-0.5">Your response</p>
                <p className="text-xs text-white/70">{ticket.adminMessage}</p>
              </div>
            )}

            {ticket.status === "open" && (
              <div className="space-y-2 pt-1">
                {actionTicketId === ticket.id ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Optional message to user..."
                      value={adminMessage}
                      onChange={e => setAdminMessage(e.target.value)}
                      className="h-20 text-xs bg-[#0d0d0d] border-white/10 resize-none"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {(["refund", "replace", "resolved"] as const).map(action => (
                        <Button
                          key={action}
                          size="sm"
                          disabled={actionMutation.isPending}
                          className={`text-xs h-8 ${
                            action === "refund"
                              ? "bg-red-700 hover:bg-red-600 text-white"
                              : action === "replace"
                              ? "bg-blue-700 hover:bg-blue-600 text-white"
                              : "bg-white/10 hover:bg-white/15 text-white/70"
                          }`}
                          onClick={() => actionMutation.mutate({ id: ticket.id, action })}
                        >
                          {actionMutation.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : action.charAt(0).toUpperCase() + action.slice(1)}
                        </Button>
                      ))}
                    </div>
                    <button
                      onClick={() => { setActionTicketId(null); setAdminMessage(""); }}
                      className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 border-white/10 text-white/60 hover:text-white"
                    onClick={() => setActionTicketId(ticket.id)}
                  >
                    Take Action
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
