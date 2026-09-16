import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Briefcase, Package, ShoppingBag, Plus, Trash2, ChevronRight, Loader2, ShieldX, CreditCard, Users, DollarSign, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TABS = [
  { id: "products", label: "Products & Stock", Icon: Package },
  { id: "cards", label: "Cards", Icon: CreditCard },
  { id: "bases", label: "Bases", Icon: Layers },
  { id: "orders", label: "Orders", Icon: ShoppingBag },
  { id: "users", label: "Add Balance", Icon: Users },
];

function statusLabel(s: string) {
  const map: Record<string, string> = { pending: "Pending", fulfilled: "Fulfilled", delivering: "Delivered", refunded: "Refunded", waiting_payment: "Awaiting Payment", replaced: "Replaced" };
  return map[s] || s;
}
function statusClass(s: string) {
  if (["fulfilled","delivering","replaced"].includes(s)) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "pending") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (s === "refunded") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (s === "waiting_payment") return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-[#111]/5 text-white/45 border-white/10";
}

// ────────── STOCK PANEL ──────────
function StockPanel({ variantId, variantName }: { variantId: number; variantName: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rawContent, setRawContent] = useState("");

  const { data: stockItems = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/stock", variantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stock/${variantId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const addStockMutation = useMutation({
    mutationFn: async () => {
      if (!rawContent.trim()) throw new Error("No content");
      const res = await apiRequest("POST", "/api/admin/stock/bulk", { variantId, rawContent: rawContent.trim() });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Added ${data.addedCount} items (${data.skippedCount} skipped)` });
      setRawContent("");
      qc.invalidateQueries({ queryKey: ["/api/admin/stock", variantId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteStockMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/stock/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/stock", variantId] }),
  });

  const available = stockItems.filter((i: any) => !i.isSold && !i.isReserved);

  return (
    <div className="space-y-3 pt-3 border-t border-white/10">
      <p className="text-[10px] text-white/45 uppercase tracking-widest font-mono">Stock for {variantName} — {available.length} available</p>
      <textarea
        value={rawContent}
        onChange={e => setRawContent(e.target.value)}
        placeholder={"item1_line1\nitem1_line2\n\nitem2_line1\n\n(blank line = new item)"}
        rows={4}
        className="w-full bg-[#111]/5 border border-white/10 rounded text-xs text-white font-mono p-2 outline-none focus:border-white/15 resize-none placeholder:text-white/30"
        data-testid={`textarea-stock-${variantId}`}
      />
      <Button size="sm" className="w-full h-8 text-xs" onClick={() => addStockMutation.mutate()} disabled={addStockMutation.isPending || !rawContent.trim()} data-testid={`btn-add-stock-${variantId}`}>
        {addStockMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Add Stock Items</>}
      </Button>
      {isLoading ? <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-white/40" /></div> :
        available.length === 0 ? <p className="text-xs text-white/40 text-center py-2 font-mono">No stock items</p> : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {available.slice(0, 30).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between bg-[#111]/5 border border-white/10 rounded px-2.5 py-1.5 group">
                <p className="text-[10px] font-mono text-white/45 truncate flex-1">{item.content?.substring(0, 50)}...</p>
                <button onClick={() => deleteStockMutation.mutate(item.id)} className="ml-2 text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {available.length > 30 && <p className="text-[10px] text-white/40 text-center font-mono">+{available.length - 30} more</p>}
          </div>
        )}
    </div>
  );
}

// ────────── PRODUCTS TAB ──────────
function ProductsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [expandedVariant, setExpandedVariant] = useState<number | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewVariant, setShowNewVariant] = useState<number | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newProductImage, setNewProductImage] = useState("");
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [editingVariant, setEditingVariant] = useState<{ id: number; name: string; price: string } | null>(null);

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/products"],
    queryFn: async () => { const res = await fetch("/api/admin/products", { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  const createProductMutation = useMutation({
    mutationFn: async () => {
      if (!newProductName.trim()) throw new Error("Name required");
      const res = await apiRequest("POST", "/api/products", { name: newProductName.trim(), description: newProductDesc.trim(), image: newProductImage.trim(), active: true });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Product created" }); setNewProductName(""); setNewProductDesc(""); setNewProductImage(""); setShowNewProduct(false); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createVariantMutation = useMutation({
    mutationFn: async (productId: number) => {
      if (!newVariantName.trim() || !newVariantPrice) throw new Error("Name and price required");
      const res = await apiRequest("POST", "/api/variants", { productId, name: newVariantName.trim(), price: Math.round(parseFloat(newVariantPrice) * 100) });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Variant created" }); setNewVariantName(""); setNewVariantPrice(""); setShowNewVariant(null); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/products/${id}`); },
    onSuccess: () => { toast({ title: "Product deleted" }); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editVariantMutation = useMutation({
    mutationFn: async ({ id, name, price }: { id: number; name: string; price: string }) => {
      if (!name.trim() || !price) throw new Error("Name and price required");
      const res = await apiRequest("PATCH", `/api/admin/variants/${id}`, { name: name.trim(), price: Math.round(parseFloat(price) * 100) });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Variant updated" }); setEditingVariant(null); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Products ({products.length})</h2>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewProduct(v => !v)} data-testid="btn-new-product"><Plus className="h-3.5 w-3.5" />New Product</Button>
      </div>

      {showNewProduct && (
        <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-white/45 uppercase tracking-widest">New Product</p>
          <Input placeholder="Product name" value={newProductName} onChange={e => setNewProductName(e.target.value)} className="bg-[#111]/5 border-white/10 h-8 text-sm" data-testid="input-product-name" />
          <Input placeholder="Description (optional)" value={newProductDesc} onChange={e => setNewProductDesc(e.target.value)} className="bg-[#111]/5 border-white/10 h-8 text-sm" data-testid="input-product-desc" />
          <Input placeholder="Image URL (optional)" value={newProductImage} onChange={e => setNewProductImage(e.target.value)} className="bg-[#111]/5 border-white/10 h-8 text-sm" data-testid="input-product-image" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => createProductMutation.mutate()} disabled={createProductMutation.isPending || !newProductName.trim()}>{createProductMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowNewProduct(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {products.map((product: any) => {
          const isExpanded = expandedProduct === product.id;
          const totalStock = product.variants?.reduce((sum: number, v: any) => sum + (v.stockCount || 0), 0) ?? 0;
          return (
            <div key={product.id} className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
              <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#0d0d0d] transition-colors">
                <button className="flex items-center gap-3 text-left flex-1" onClick={() => setExpandedProduct(isExpanded ? null : product.id)} data-testid={`btn-product-${product.id}`}>
                  <Package className="h-4 w-4 text-white/40 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">{product.name}</p>
                    <p className="text-[10px] text-white/40 font-mono mt-0.5">{product.variants?.length ?? 0} variants · {totalStock} in stock</p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${product.name}"?`)) deleteProductMutation.mutate(product.id); }} className="text-white/30 hover:text-red-400 transition-colors p-1" data-testid={`btn-delete-product-${product.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  <ChevronRight className={`h-4 w-4 text-white/30 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/10">
                  <div className="space-y-2 pt-3">
                    {(product.variants || []).map((variant: any) => {
                      const isVE = expandedVariant === variant.id;
                      return (
                        <div key={variant.id} className="bg-[#111]/5 border border-white/10 rounded-lg overflow-hidden">
                          {editingVariant?.id === variant.id ? (
                            <div className="px-3 py-2.5 space-y-2">
                              <div className="flex gap-2">
                                <Input value={editingVariant!.name} onChange={e => setEditingVariant(v => v ? { ...v, name: e.target.value } : v)} placeholder="Name" className="flex-1 bg-[#111]/5 border-white/10 h-7 text-xs" />
                                <Input value={editingVariant!.price} onChange={e => setEditingVariant(v => v ? { ...v, price: e.target.value } : v)} placeholder="Price $" type="number" step="0.01" className="w-24 bg-[#111]/5 border-white/10 h-7 text-xs" />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => editVariantMutation.mutate(editingVariant!)} disabled={editVariantMutation.isPending}>{editVariantMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}</Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingVariant(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center w-full">
                              <button className="flex-1 flex items-center justify-between px-3 py-2.5 hover:bg-[#0d0d0d] transition-colors text-left" onClick={() => setExpandedVariant(isVE ? null : variant.id)} data-testid={`btn-variant-${variant.id}`}>
                                <div><p className="text-xs font-bold text-white">{variant.name}</p><p className="text-[10px] text-white/40 font-mono">${(variant.price / 100).toFixed(2)} · {variant.stockCount} in stock</p></div>
                                <ChevronRight className={`h-3.5 w-3.5 text-white/30 transition-transform ${isVE ? "rotate-90" : ""}`} />
                              </button>
                              <button onClick={() => setEditingVariant({ id: variant.id, name: variant.name, price: (variant.price / 100).toFixed(2) })} className="px-2.5 text-white/30 hover:text-primary transition-colors" data-testid={`btn-edit-variant-${variant.id}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            </div>
                          )}
                          {isVE && editingVariant?.id !== variant.id && <div className="px-3 pb-3"><StockPanel variantId={variant.id} variantName={variant.name} /></div>}
                        </div>
                      );
                    })}
                  </div>
                  {showNewVariant === product.id ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] text-white/45 uppercase tracking-widest font-mono">New Variant</p>
                      <div className="flex gap-2">
                        <Input placeholder="Variant name" value={newVariantName} onChange={e => setNewVariantName(e.target.value)} className="flex-1 bg-[#111]/5 border-white/10 h-8 text-xs" data-testid="input-variant-name" />
                        <Input placeholder="Price $" type="number" step="0.01" value={newVariantPrice} onChange={e => setNewVariantPrice(e.target.value)} className="w-24 bg-[#111]/5 border-white/10 h-8 text-xs" data-testid="input-variant-price" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => createVariantMutation.mutate(product.id)} disabled={createVariantMutation.isPending}>{createVariantMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add Variant"}</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowNewVariant(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setShowNewVariant(product.id); setNewVariantName(""); setNewVariantPrice(""); }} className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-white/10 rounded text-xs text-white/40 hover:text-white hover:border-white/15 transition-colors" data-testid={`btn-add-variant-${product.id}`}>
                      <Plus className="h-3 w-3" /> Add Variant
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────── CARDS TAB ──────────
function CardsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fullItem, setFullItem] = useState("");
  const [price, setPrice] = useState("");
  const [selectedBaseId, setSelectedBaseId] = useState<string>("");

  const { data: cards = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/cards"] });
  const basesQueryKey = user?.role === "admin" ? "/api/card-bases" : "/api/worker/card-bases";
  const { data: bases = [] } = useQuery<any[]>({ queryKey: [basesQueryKey] });

  const previewBin = (() => {
    const tokens = fullItem.split(/[|\t:;,\s]+/).map((t: string) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const digits = token.replace(/\D/g, "");
      if (digits.length >= 13 && digits.length <= 19 && /^[3456]/.test(digits)) return digits.substring(0, 6);
    }
    const m = fullItem.replace(/[\s\-]/g, "").match(/[3456]\d{12,18}/);
    return m ? m[0].substring(0, 6) : "";
  })();

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!fullItem.trim()) throw new Error("Full item is required");
      if (!price || parseFloat(price) <= 0) throw new Error("Valid price is required");
      if (!selectedBaseId) throw new Error("Base is required");
      const res = await apiRequest("POST", "/api/cards", { extras: fullItem.trim(), price: parseFloat(price), baseId: Number(selectedBaseId) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "Card added" }); setFullItem(""); setPrice(""); setSelectedBaseId(""); qc.invalidateQueries({ queryKey: ["/api/cards"] }); qc.invalidateQueries({ queryKey: [basesQueryKey] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/cards/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cards"] }); toast({ title: "Card deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-white">Cards ({cards.length})</h2>

      <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-white/45 uppercase tracking-widest">Add Card</p>
        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Full Delivery Item</label>
          <textarea value={fullItem} onChange={e => setFullItem(e.target.value)} placeholder={"4111111111111111|12/25|123|John Doe|Address"} rows={3} className="w-full bg-[#111]/5 border border-white/10 rounded text-xs text-white font-mono p-2 outline-none focus:border-white/15 resize-none placeholder:text-white/30" data-testid="input-full-item" />
          {previewBin.length === 6 && <p className="text-[10px] text-primary/60 font-mono">BIN: {previewBin} (auto-lookup on save)</p>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Base <span className="text-red-400/70">*</span></label>
          <select
            value={selectedBaseId}
            onChange={e => setSelectedBaseId(e.target.value)}
            className="w-full bg-[#111]/5 border border-white/10 rounded text-xs text-white py-2 px-2 outline-none focus:border-white/15"
            data-testid="select-card-base"
          >
            <option value="">— Select base —</option>
            {(bases as any[]).map((b: any) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/45 uppercase tracking-widest">Price ($)</label>
          <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="5.00" type="number" step="0.01" className="bg-[#111]/5 border-white/10 h-8" data-testid="input-card-price" />
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !fullItem.trim() || !price || !selectedBaseId} data-testid="btn-add-card">
          {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add Card"}
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {(cards as any[]).map((card: any) => {
            const cBin = (card.cardNumber || "").replace(/\D/g, "").substring(0, 6);
            return (
              <div key={card.id} className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between" data-testid={`row-card-${card.id}`}>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-xs font-mono font-bold text-primary">🔥 {card.hrPercent ?? 80}% HR 🔥</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-[#111]/5 border border-white/10 px-1.5 py-0.5 rounded text-white/45">{cBin}</span>
                    {card.binData?.bank && <span className="text-[10px] text-white/40 font-mono">{card.binData.bank}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="font-mono text-sm text-white">${(card.price / 100).toFixed(2)}</span>
                  <button onClick={() => deleteMutation.mutate(card.id)} disabled={deleteMutation.isPending} className="text-white/30 hover:text-red-400 transition-colors" data-testid={`btn-delete-card-${card.id}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
          {cards.length === 0 && <p className="text-center text-xs text-white/40 py-6 font-mono">No cards</p>}
        </div>
      )}
    </div>
  );
}

// ────────── BASES TAB ──────────
function BasesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [refundable, setRefundable] = useState(false);
  const { data: bases = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/worker/card-bases"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Base name is required");
      const res = await apiRequest("POST", "/api/worker/card-bases", { name: name.trim(), refundable });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create base");
      }
      return res.json();
    },
    onSuccess: () => {
      setName("");
      setRefundable(false);
      qc.invalidateQueries({ queryKey: ["/api/worker/card-bases"] });
      toast({ title: "Base created" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const base = bases[0];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white">Your Card Base</h2>
        <p className="text-[10px] text-white/40 font-mono mt-1">Workers can create one base. Cards added to it are included in the profit estimate.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : base ? (
        <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-white font-mono">{base.name}</p>
              <p className="text-[10px] text-white/40 font-mono mt-1">{base.count} available · {base.soldCount ?? 0} sold</p>
            </div>
            {base.refundable && <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[9px]">REFUNDABLE</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#111]/5 border border-white/10 rounded-lg p-3">
              <p className="text-[9px] uppercase tracking-widest text-white/35">Base revenue</p>
              <p className="text-lg font-bold font-mono text-green-400 mt-1">${((base.revenue ?? base.profit ?? 0) / 100).toFixed(2)}</p>
              <p className="text-[9px] text-white/30 mt-1">price × base valid rate</p>
            </div>
            <div className="bg-[#111]/5 border border-white/10 rounded-lg p-3">
              <p className="text-[9px] uppercase tracking-widest text-white/35">Cards in stock</p>
              <p className="text-lg font-bold font-mono text-white mt-1">{base.count}</p>
              <p className="text-[9px] text-white/30 mt-1">{base.soldCount ?? 0} sold cards</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-white/45 uppercase tracking-widest">Create your one base</p>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Base name (e.g. MY BASE)"
            className="bg-[#111]/5 border-white/10 h-8 text-sm"
            data-testid="input-worker-base-name"
          />
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input type="checkbox" checked={refundable} onChange={e => setRefundable(e.target.checked)} className="h-3.5 w-3.5 accent-primary" data-testid="checkbox-worker-base-refundable" />
            Refundable base
          </label>
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !name.trim()}
            data-testid="btn-create-worker-base"
          >
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Create Base</>}
          </Button>
        </div>
      )}
    </div>
  );
}

// ────────── ORDERS TAB ──────────
function OrdersTab() {
  const [search, setSearch] = useState("");
  const { data: orders = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/worker/orders"],
    queryFn: async () => {
      const res = await fetch("/api/worker/orders", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load worker orders");
      return res.json();
    },
    refetchInterval: 15000,
  });
  const filtered = orders.filter((o: any) => !search || o.orderId?.toLowerCase().includes(search.toLowerCase()) || o.user?.username?.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-white">Orders ({orders.length})</h2>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order ID or username..." className="w-full h-8 bg-[#0d0d0d] border border-white/10 rounded px-3 text-xs text-white placeholder:text-white/40 outline-none" data-testid="input-orders-search" />
      <div className="space-y-1.5">
        {filtered.slice(0, 50).map((order: any) => (
          <div key={order.id} className="bg-[#111] border border-white/10 rounded-xl px-3 py-2.5" data-testid={`row-order-${order.id}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Badge className={`text-[10px] flex-shrink-0 ${statusClass(order.status)}`}>{statusLabel(order.status)}</Badge>
                <p className="text-xs font-mono text-white/45 truncate">{order.orderId}</p>
              </div>
              <span className="text-xs font-mono text-white flex-shrink-0 ml-2">{order.total > 0 ? `$${(order.total / 100).toFixed(2)}` : "—"}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-white/40 font-mono">{order.user?.username || order.userId} · {order.paymentMethod || "—"}</p>
              <p className="text-[10px] text-white/30 font-mono">{new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
         {isError ? (
           <p className="text-center text-xs text-red-400/80 py-8 font-mono">Orders could not be loaded. Refresh and try again.</p>
         ) : filtered.length === 0 ? (
           <p className="text-center text-xs text-white/40 py-8 font-mono">No orders found</p>
         ) : null}
      </div>
    </div>
  );
}

// ────────── USERS / BALANCE TAB ──────────
function UsersBalanceTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [balanceAmount, setBalanceAmount] = useState("");

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => { const res = await fetch("/api/admin/users", { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  const addBalanceMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: number; amount: number }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/balance`, { amount: Math.round(amount * 100) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser((u: any) => u ? { ...u, balance: data.balance } : null);
      setBalanceAmount("");
      toast({ title: `Balance updated — new balance: $${(data.balance / 100).toFixed(2)}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = (users as any[]).filter((u: any) =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-white">Add Balance to User</h2>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username or email..." className="w-full h-8 bg-[#0d0d0d] border border-white/10 rounded px-3 text-xs text-white placeholder:text-white/40 outline-none" data-testid="input-user-search" />

      {selectedUser ? (
        <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">@{selectedUser.username}</p>
              <p className="text-xs text-white/45 font-mono">Balance: ${(selectedUser.balance / 100).toFixed(2)}</p>
            </div>
            <button onClick={() => setSelectedUser(null)} className="text-xs text-white/40 hover:text-white transition-colors font-mono">← back</button>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/45 uppercase tracking-widest">Amount to Add ($)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/45 font-mono">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={balanceAmount}
                  onChange={e => setBalanceAmount(e.target.value)}
                  className="w-full h-9 bg-[#111]/5 border border-white/10 rounded-lg pl-7 pr-3 text-sm text-white font-mono outline-none focus:border-primary/40"
                  data-testid="input-balance-amount"
                />
              </div>
              <Button
                size="sm"
                className="h-9 px-4"
                onClick={() => { const amt = parseFloat(balanceAmount); if (!amt) return; addBalanceMutation.mutate({ userId: selectedUser.id, amount: amt }); }}
                disabled={addBalanceMutation.isPending || !balanceAmount || parseFloat(balanceAmount) === 0}
                data-testid="btn-add-balance"
              >
                {addBalanceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><DollarSign className="h-3.5 w-3.5 mr-1" />Add</>}
              </Button>
            </div>
            <p className="text-[10px] text-white/40 font-mono">use negative number to subtract balance</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> :
            filtered.slice(0, 30).map((u: any) => (
              <button key={u.id} onClick={() => setSelectedUser(u)} className="w-full flex items-center justify-between bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/10 transition-colors text-left" data-testid={`btn-select-user-${u.id}`}>
                <div>
                  <p className="text-xs font-bold text-white">@{u.username}</p>
                  <p className="text-[10px] text-white/40 font-mono">${(u.balance / 100).toFixed(2)}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-white/30" />
              </button>
            ))
          }
          {filtered.length === 0 && !isLoading && <p className="text-center text-xs text-white/40 py-6 font-mono">No users found</p>}
        </div>
      )}
    </div>
  );
}

// ────────── MAIN PAGE ──────────
export default function WorkerDashboardPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("products");

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const isWorkerOrAdmin = (user as any)?.isWorker || user?.role === "admin";
  if (!isWorkerOrAdmin) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <ShieldX className="h-14 w-14 text-destructive" />
      <h1 className="text-lg font-bold text-white">Access Denied</h1>
      <p className="text-xs text-white/45">Worker access required</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
          <Briefcase className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Worker Dashboard</h1>
          <p className="text-[10px] text-white/40 font-mono">@{user?.username}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-5 gap-1 bg-[#0d0d0d] rounded-lg p-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-0.5 py-2 rounded text-xs font-semibold transition-colors ${activeTab === id ? "bg-[#111]/5 text-white" : "text-white/45 hover:text-white/60"}`}
            data-testid={`tab-${id}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[9px]">{label}</span>
          </button>
        ))}
      </div>

      {activeTab === "products" && <ProductsTab />}
      {activeTab === "cards" && <CardsTab />}
      {activeTab === "bases" && <BasesTab />}
      {activeTab === "orders" && <OrdersTab />}
      {activeTab === "users" && <UsersBalanceTab />}
    </div>
  );
}
