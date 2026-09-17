import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/hooks/use-orders";
import { useWallet } from "@/hooks/use-wallet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, Package, Clock, Gift, Mail, Key, User, Calendar, Link2, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { SiBitcoin } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { CryptoPaymentModal } from "@/components/CryptoPaymentModal";
import { queryClient } from "@/lib/queryClient";
import { formatDate, formatDateTime, formatTime } from "@/lib/date-utils";

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const orderId = searchParams.get("order");
  const tabParam = searchParams.get("tab");  
  const { data: orders } = useOrders();
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(() => {
    if (tabParam === "orders") return "orders";
    if (tabParam === "balance") return "balance";
    return "dashboard";
  });

  const { toast } = useToast();

  useEffect(() => {
    if (tabParam === "orders") setActiveTab("orders");
    else if (tabParam === "balance") setActiveTab("balance");
  }, [tabParam]);

  useEffect(() => {
    if (orderId && orders) {
      const order = orders.find((o: any) => o.orderId === orderId || o.id.toString() === orderId);
      if (order) {
        setSelectedOrder(order);
        setActiveTab("orders");
      }
    }
  }, [orderId, orders]);

  if (isLoading || !user) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 pb-20">
      <div>
        <p className="text-xs text-muted-foreground">Your account</p>
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 h-auto rounded-none gap-6">
          <TabsTrigger value="dashboard" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 text-sm font-medium">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 text-sm font-medium">
            Orders
          </TabsTrigger>
          <TabsTrigger value="balance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 text-sm font-medium">
            Balance
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 text-sm font-medium">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="pt-6">
          <DashboardTab user={user} logout={logout} />
        </TabsContent>

        <TabsContent value="orders" className="pt-6">
          <OrdersTab />
        </TabsContent>

        <TabsContent value="balance" className="pt-6">
          <BalanceTab user={user} />
        </TabsContent>

        <TabsContent value="settings" className="pt-6">
          <SettingsTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashboardTab({ user, logout }: { user: any; logout: () => void }) {
  return (
    <Card className="bg-card/40 border-border">
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Username</p>
          <p className="text-lg font-bold text-foreground">{user.username}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
          <p className="text-lg font-bold text-foreground">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Telegram</p>
          <p className="text-lg font-bold text-foreground">{user.telegramUsername}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Member Since</p>
          <p className="text-sm text-foreground">{formatDate(user.createdAt)}</p>
        </div>
        <button 
          onClick={logout}
          className="w-full h-10 mt-4 bg-destructive/20 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/30 transition-colors font-bold uppercase tracking-wider text-sm"
        >
          Logout
        </button>
      </CardContent>
    </Card>
  );
}

function SettingsTab({ user }: { user: any }) {
  const { logout } = useAuth();
  const [newTelegram, setNewTelegram] = useState(user.telegramUsername || "");
  const [newEmail, setNewEmail] = useState(user.email || "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const { toast } = useToast();

  const handleUpdateTelegram = async () => {
    try {
      const res = await fetch("/api/user/telegram", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUsername: newTelegram }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Telegram Updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update telegram", variant: "destructive" });
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return toast({ title: "Error", description: "Email is required", variant: "destructive" });
    if (newEmail !== confirmEmail) return toast({ title: "Error", description: "Emails do not match", variant: "destructive" });
    try {
      const res = await fetch("/api/user/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      toast({ title: "Email Updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update email", variant: "destructive" });
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      toast({ title: "Password Updated" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update password", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">ID:</span>
            <span className="font-mono text-xs">{user.id}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Username:</span>
            <span className="text-foreground">{user.username}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Email:</span>
            <span className="text-foreground">{user.email || user.username}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Referer:</span>
            <span className="text-foreground">N/A</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Joined:</span>
            <span className="text-foreground">{formatDate(user.createdAt)} {formatTime(user.createdAt)}</span>
          </div>
          
          <div className="flex items-center gap-3 pt-4">
            <Button variant="outline" className="border-destructive/30 text-destructive" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-lg">Change Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">New Email</label>
            <Input 
              placeholder="name@example.com" 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              data-testid="input-new-email"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Confirm Email</label>
            <Input 
              placeholder="name@example.com" 
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              data-testid="input-confirm-email"
            />
          </div>
          <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" onClick={handleUpdateEmail} data-testid="button-update-email">
            <Mail className="h-4 w-4 mr-2" /> Update Email
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Current Password</label>
            <Input 
              type="password"
              placeholder="Current password" 
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              data-testid="input-current-password"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">New Password</label>
            <Input 
              type="password"
              placeholder="********" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              data-testid="input-new-password"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Confirm Password</label>
            <Input 
              type="password"
              placeholder="********" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              data-testid="input-confirm-password"
            />
          </div>
          <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" onClick={handleUpdatePassword} data-testid="button-update-password">
            <Key className="h-4 w-4 mr-2" /> Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OrdersTab() {
  const { data: orders, isLoading, refetch } = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;
  
  return (
    <div className="space-y-4">
      {!orders || orders.length === 0 ? (
        <div className="text-center py-20 opacity-50">
          <Package className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-sm font-bold mb-2">No orders found</h3>
          <Link href="/">
            <Button size="sm" className="text-primary">Browse Marketplace</Button>
          </Link>
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium">#</th>
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Title</th>
                    <th className="text-left p-4 font-medium">Total</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-right p-4">
                      <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh-orders">
                        <Clock className="h-4 w-4" />
                      </Button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const productItems = order.items.filter((i: any) => i.itemType !== 'card');
                    const cardItems = order.items.filter((i: any) => i.itemType === 'card');
                    const titleParts: string[] = [];
                    if (productItems.length > 0) titleParts.push(productItems.map((i: any) => i.variant?.name || 'Product').join(', '));
                    if (cardItems.length > 0) titleParts.push(`${cardItems.length} Card${cardItems.length > 1 ? 's' : ''}`);
                    const hasCards = cardItems.length > 0;
                    const hasProducts = productItems.length > 0;
                    const typeLabel = hasCards && hasProducts ? 'Mixed' : hasCards ? 'Cards' : 'Order';

                    return (
                    <tr key={order.id} className="border-b border-border last:border-0 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setSelectedOrder(order)}>
                      <td className="p-4">{index + 1}</td>
                      <td className="p-4">
                        <Badge variant="outline" className={hasCards && !hasProducts ? 'border-yellow-500/30 text-yellow-500' : hasCards && hasProducts ? 'border-purple-500/30 text-purple-400' : 'border-destructive/30 text-destructive'}>
                          {typeLabel}
                        </Badge>
                      </td>
                      <td className="p-4 truncate max-w-[200px]">
                        {titleParts.join(' + ')}
                      </td>
                      <td className="p-4 text-red-500">${(order.total / 100).toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`flex items-center gap-2 ${
                          (order.status as string) === 'fulfilled' || (order.status as string) === 'paid' || (order.status as string) === 'delivering' || (order.status as string) === 'replaced' ? 'text-red-500'
                          : (order.status as string) === 'unpaid' || (order.status as string) === 'waiting_payment' ? 'text-red-500'
                          : (order.status as string) === 'refunded' ? 'text-orange-400'
                          : 'text-primary'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            (order.status as string) === 'fulfilled' || (order.status as string) === 'paid' || (order.status as string) === 'delivering' || (order.status as string) === 'replaced' ? 'bg-red-500'
                            : (order.status as string) === 'unpaid' || (order.status as string) === 'waiting_payment' ? 'bg-red-500'
                            : (order.status as string) === 'refunded' ? 'bg-orange-400'
                            : 'bg-primary'
                          }`} />
                          {(order.status as string) === 'fulfilled' || (order.status as string) === 'delivering' ? 'Fulfilled' : (order.status as string) === 'paid' ? 'Paid' : (order.status as string) === 'replaced' ? 'Replaced' : (order.status as string) === 'refunded' ? 'Refunded' : (order.status as string) === 'pending' ? 'Pending' : (order.status as string) === 'unpaid' || (order.status as string) === 'waiting_payment' ? 'Unpaid' : order.status}
                          <br />
                          <span className="text-xs text-muted-foreground">on {formatDate(order.createdAt)}</span>
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button size="icon" variant="ghost" className="text-primary" data-testid={`button-view-order-${order.id}`}>
                          <Package className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
              <span className="text-muted-foreground">«</span>
              <span className="text-sm">1 of 1</span>
              <span className="text-muted-foreground">»</span>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedOrder && (
        <OrderDetailsSheet 
          order={selectedOrder} 
          open={!!selectedOrder} 
          onOpenChange={(open) => !open && setSelectedOrder(null)} 
        />
      )}
    </div>
  );
}

function OrderDetailsSheet({ order, open, onOpenChange }: { order: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [activeTab, setActiveTab] = useState("info");
  const [viewingStockIdx, setViewingStockIdx] = useState<number | null>(null);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  };

  const viewingItem = viewingStockIdx !== null ? order.items?.[viewingStockIdx] : null;

  if (viewingItem) {
    const content = viewingItem.itemType === 'card' && viewingItem.card
      ? `${viewingItem.card.cardNumber} | ${viewingItem.card.expiry} | ${viewingItem.card.cvv}`
      : viewingItem.stockItem?.content || '';

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md bg-[#0e0e0e] border-l border-white/10 text-foreground p-0">
          <div className="p-6 space-y-6 h-full flex flex-col">
            <h2 className="text-lg font-semibold">Order info</h2>

            <div className="flex-1 flex flex-col gap-4">
              <div
                className="bg-black border border-white/10 text-foreground rounded-lg p-4 text-sm font-mono break-all cursor-pointer min-h-[120px] space-y-3"
                onClick={() => copyToClipboard(content)}
                data-testid="stock-content-box"
              >
                {content.split(/\n\n+/).filter(Boolean).map((chunk: string, ci: number, arr: string[]) => (
                  <div key={ci}>
                    <span className="whitespace-pre-wrap">{chunk.trim()}</span>
                    {ci < arr.length - 1 && <div className="mt-3 border-t border-white/10" />}
                  </div>
                ))}
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase italic tracking-tighter text-xs h-10"
                onClick={() => setViewingStockIdx(null)}
                data-testid="button-stock-back"
              >
                Back
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-[#0e0e0e] border-l border-white/10 text-foreground p-0">
        <div className="p-6 space-y-6 h-full flex flex-col">
          <h2 className="text-lg font-semibold">Order info</h2>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1">
            <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none p-0 h-auto gap-8">
              <TabsTrigger 
                value="info" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground data-[state=active]:text-primary"
              >
                Info
              </TabsTrigger>
              <TabsTrigger 
                value="products" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground data-[state=active]:text-primary"
              >
                Products
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="pt-6 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">ID</p>
                <p className="text-xs font-mono break-all">{order.orderId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Creation date</p>
                <p className="text-xs">{formatDateTime(order.createdAt)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Reason</p>
                <p className="text-xs">cart</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Expected amount</p>
                <p className="text-xs">${(order.total / 100).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Paid amount</p>
                <p className="text-xs">${(order.total / 100).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Status</p>
                <p className={`text-xs font-bold ${
                  order.status === 'fulfilled' || order.status === 'paid' || order.status === 'delivering' || order.status === 'replaced' ? 'text-red-500'
                  : order.status === 'unpaid' || order.status === 'waiting_payment' ? 'text-red-500'
                  : order.status === 'refunded' ? 'text-orange-400'
                  : 'text-primary'
                }`}>
                  {order.status === 'fulfilled' || order.status === 'delivering' ? 'Fulfilled' : order.status === 'paid' ? 'Paid' : order.status === 'replaced' ? 'Replaced' : order.status === 'refunded' ? 'Refunded' : order.status === 'pending' ? 'Pending' : order.status === 'unpaid' || order.status === 'waiting_payment' ? 'Unpaid' : order.status}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="products" className="pt-6 space-y-6 overflow-y-auto max-h-[60vh]">
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="space-y-4 border-b border-white/10 pb-6 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={item.itemType === 'card' ? 'border-yellow-500/30 text-yellow-500 text-[9px]' : 'border-primary/30 text-primary text-[9px]'}>
                      {item.itemType === 'card' ? '💳 Credit Card' : '📦 Product'}
                    </Badge>
                  </div>

                  {item.itemType === 'card' ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Card</p>
                        <p className="text-xs font-bold font-mono">{item.card?.maskedCard || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Country</p>
                        <p className="text-xs font-bold">{item.card?.country || 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Product</p>
                        <p className="text-xs font-bold">{item.variant?.product?.name || item.variant?.name || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Option</p>
                        <p className="text-xs font-bold">{item.variant?.name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Quantity</p>
                        <p className="text-xs font-bold">{item.quantity}</p>
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Unit price</p>
                    <p className="text-xs font-bold">${(item.price / 100).toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total</p>
                    <p className="text-xs font-bold">${((item.price * item.quantity) / 100).toFixed(2)}</p>
                  </div>

                  {(order.status === 'fulfilled' || order.status === 'paid' || order.status === 'delivering' || order.status === 'replaced') && (item.stockItem || (item.itemType === 'card' && item.card)) && (
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase italic tracking-tighter text-xs h-10"
                      onClick={() => setViewingStockIdx(idx)}
                      data-testid={`button-view-stock-${idx}`}
                    >
                      View stock
                    </Button>
                  )}
                  {order.status === 'pending' && (
                    <p className="text-xs text-primary text-center font-medium">Awaiting payment confirmation</p>
                  )}
                  {order.status === 'unpaid' && (
                    <p className="text-xs text-red-500 text-center font-medium">Order cancelled</p>
                  )}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BalanceTab({ user }: { user: any }) {
  const { redeemCode } = useWallet();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCryptoModal, setShowCryptoModal] = useState(false);

  const handleRedeem = () => {
    if (!giftCardCode.trim()) return;
    setLoading(true);
    redeemCode.mutate(giftCardCode, {
      onSuccess: () => { setGiftCardCode(""); setLoading(false); },
      onError: () => setLoading(false)
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Current Balance</span>
            <span className="text-red-500 font-bold text-xl">${(user.balance / 100).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-red-900/20 border-red-500/20">
        <CardContent className="p-4">
          <p className="text-sm text-red-300">
            Balance decays at 0.7% per hour of your current balance to keep purchasing fair for everyone.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Amount to charge</h3>
            <Input 
              placeholder="amount to charge in $" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-charge-amount"
            />
          </div>

          <Button 
            className="w-full h-12"
            onClick={() => {
              if (!amount || parseFloat(amount) < 0.50) {
                toast({ title: "Error", description: "Minimum top-up is $0.50", variant: "destructive" });
                return;
              }
              setShowCryptoModal(true);
            }}
            data-testid="button-charge"
          >
            <SiBitcoin className="h-4 w-4 mr-2" />
            Top Up with Crypto
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-lg">Redeem Gift Card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Gift Card Code</label>
            <Input 
              placeholder="XXXX-XXXX-XXXX-XXXX" 
              value={giftCardCode}
              onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
              className="font-mono"
              data-testid="input-gift-card"
            />
          </div>
          <Button 
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold"
            onClick={handleRedeem}
            disabled={loading || !giftCardCode.trim()}
            data-testid="button-redeem-gift-card"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
            Redeem
          </Button>
        </CardContent>
      </Card>

      <CryptoPaymentModal
        open={showCryptoModal}
        onOpenChange={setShowCryptoModal}
        total={Math.round(parseFloat(amount || "0") * 100)}
        purpose="deposit"
        onSuccess={() => {
          setShowCryptoModal(false);
          setAmount("");
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }}
      />
    </div>
  );
}
