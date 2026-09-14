import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, ShoppingCart, ChevronDown, X, Loader2, SlidersHorizontal } from "lucide-react";
import { useLocation, Redirect } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  return String.fromCodePoint(...upper.split("").map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

const countryDisplayNames = typeof Intl !== "undefined" && (Intl as any).DisplayNames
  ? new (Intl as any).DisplayNames(["en"], { type: "region" })
  : null;

function countryName(code: string): string {
  if (!code || code.length !== 2) return "";
  try {
    return countryDisplayNames?.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function extractBin(cardNumber: string): string {
  return (cardNumber ?? "").replace(/\D/g, "").substring(0, 6);
}

function extractZip(extras: string): string {
  if (!extras) return "";
  const tokens = extras.split(/[|\t:;,\s]+/).map(t => t.trim()).filter(Boolean);
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

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

function extractCity(extras: string): string {
  if (!extras) return "";
  const parts = extras.split(/[|\t]/);
  // Find state abbreviation index, city is typically just before it
  for (let i = 1; i < parts.length; i++) {
    const t = parts[i].trim();
    if (US_STATES.has(t)) {
      // city is the token before the state (skip blanks)
      for (let j = i - 1; j >= 0; j--) {
        const c = parts[j].trim();
        if (c && c.length > 1 && !/^\d/.test(c) && !c.includes("@") && !c.includes(".") && !/^\d{1,3}\.\d{1,3}/.test(c)) {
          return c.length > 20 ? c.substring(0, 18) + "…" : c;
        }
      }
      break;
    }
  }
  return "";
}

function hasBilling(extras: string): boolean {
  return (extras ?? "").split(/[|\t]/).length >= 5;
}

function formatType(binData: any): string {
  if (!binData) return "";
  const t = binData.type?.toUpperCase();
  return t || "";
}

function formatBank(binData: any): string {
  if (!binData) return "";
  const b = binData.bank;
  if (!b || b === "Unknown") return "";
  return b.length > 18 ? b.substring(0, 16) + "..." : b;
}

export default function CardsPage() {
  const [search, setSearch] = useState("");
  const [zipSearch, setZipSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBase, setSelectedBase] = useState<number | null>(null);
  const [showBaseDropdown, setShowBaseDropdown] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [cartCardIds, setCartCardIds] = useState<Set<number>>(new Set());
  const [cartPurchasing, setCartPurchasing] = useState<{ current: number; total: number; done: boolean } | null>(null);

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: features } = useQuery<{ cards: boolean }>({
    queryKey: ["/api/settings/features"],
    staleTime: 30000,
  });

  const { data: bases } = useQuery<any[]>({
    queryKey: ["/api/card-bases"],
    refetchInterval: 30000,
  });

  if (features && features.cards === false) return <Redirect to="/" />;

  const { data: cards, isLoading } = useQuery<any[]>({
    queryKey: ["/api/cards", selectedBase],
    queryFn: async () => {
      const url = selectedBase ? `/api/cards?baseId=${selectedBase}` : "/api/cards";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 20000,
  });

  const availableBanks = useMemo(() => {
    if (!cards) return [];
    const set = new Set<string>();
    cards.forEach((c: any) => { const b = c.binData?.bank; if (b && b !== "Unknown") set.add(b); });
    return Array.from(set).sort();
  }, [cards]);

  const availableCountries = useMemo(() => {
    if (!cards) return [];
    const set = new Set<string>();
    cards.forEach((c: any) => { const code = c.binData?.countryCode; if (code) set.add(code.toUpperCase()); });
    return Array.from(set).sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (!cards) return [];
    return cards.filter((card: any) => {
      const q = search.toLowerCase();
      const matchSearch = !search
        || extractBin(card.cardNumber).includes(q)
        || (card.baseName ?? "").toLowerCase().includes(q)
        || (card.binData?.scheme ?? "").toLowerCase().includes(q)
        || (card.binData?.type ?? "").toLowerCase().includes(q)
        || (card.binData?.brand ?? "").toLowerCase().includes(q);
      const matchZip = !zipSearch || extractZip(card.extras ?? "").startsWith(zipSearch.trim());
      const cardPrice = card.price / 100;
      const matchMin = !priceMin || cardPrice >= parseFloat(priceMin);
      const matchMax = !priceMax || cardPrice <= parseFloat(priceMax);
      const matchBank = !selectedBank || (card.binData?.bank === selectedBank);
      const matchCountry = !selectedCountry || ((card.binData?.countryCode ?? "").toUpperCase() === selectedCountry);
      return matchSearch && matchZip && matchMin && matchMax && matchBank && matchCountry;
    });
  }, [cards, search, zipSearch, priceMin, priceMax, selectedBank, selectedCountry]);

  const cartCards = useMemo(() => (cards ?? []).filter((c: any) => cartCardIds.has(c.id)), [cards, cartCardIds]);
  const cartTotal = cartCards.reduce((s: number, c: any) => s + c.price, 0);

  const toggleCart = (card: any) => {
    setCartCardIds(prev => {
      const next = new Set(prev);
      if (next.has(card.id)) next.delete(card.id); else next.add(card.id);
      return next;
    });
  };

  const toggleAll = () => {
    if (cartCardIds.size === filteredCards.length) {
      setCartCardIds(new Set());
    } else {
      setCartCardIds(new Set(filteredCards.map((c: any) => c.id)));
    }
  };

  const purchaseCart = async () => {
    if (cartCards.length === 0) return;
    setCartPurchasing({ current: 0, total: cartCards.length, done: false });
    let ok = 0;
    for (let i = 0; i < cartCards.length; i++) {
      setCartPurchasing({ current: i + 1, total: cartCards.length, done: false });
      try {
        const res = await apiRequest("POST", `/api/cards/${cartCards[i].id}/purchase`, {});
        if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: `Card ${i + 1} failed`, description: err.message, variant: "destructive" }); }
        else ok++;
      } catch { toast({ title: `Card ${i + 1} failed`, variant: "destructive" }); }
    }
    setCartPurchasing({ current: cartCards.length, total: cartCards.length, done: true });
    queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    setCartCardIds(new Set());
    setTimeout(() => {
      setCartPurchasing(null);
      if (ok > 0) { toast({ title: `${ok} card${ok > 1 ? "s" : ""} purchased` }); setLocation("/orders"); }
    }, 800);
  };

  const activeFilters = (zipSearch ? 1 : 0) + (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (selectedBank ? 1 : 0) + (selectedCountry ? 1 : 0);
  const clearFilters = () => { setZipSearch(""); setPriceMin(""); setPriceMax(""); setSelectedBank(""); setSelectedCountry(""); };

  return (
    <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto">


      {/* ── Hero ── */}
      <div className="text-center pt-8 pb-4 space-y-1">
        <h1 className="text-3xl sm:text-4xl font-black text-primary tracking-wide uppercase">TurtleCC</h1>
        <p className="text-sm text-white/50">Providing high quality cards since 2026.</p>
      </div>

      {/* Bases + Search + controls */}
      <div className="px-3 pt-3 pb-2 space-y-2.5 bg-background sticky top-[52px] z-30 border-b border-white/[0.05]">

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/35" />
          <input
            type="text"
            placeholder="Search by card type, category, keywords..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 bg-[#111] border border-white/10 rounded-2xl pl-9 pr-3 text-xs text-white/90 placeholder:text-white/35 outline-none focus:border-white/20 transition-colors"
            data-testid="input-search"
          />
        </div>

        {/* Base dropdown + Filters button */}
        <div className="flex gap-1.5">
          {/* Base dropdown */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowBaseDropdown(d => !d)}
              className="w-full flex items-center justify-between bg-[#0d0d0d] border border-white/10 rounded-lg px-2.5 h-8 text-[11px] text-white/60 hover:text-white/80 transition-colors"
              data-testid="btn-base-dropdown"
            >
              <span className="truncate">
                {selectedBase === null
                  ? `All Bases · ${(bases ?? []).reduce((s: number, b: any) => s + (b.count ?? 0), 0)}`
                  : (() => { const b = (bases ?? []).find((b: any) => b.id === selectedBase); return b ? `${b.name} · ${b.count ?? 0}` : "All Bases"; })()
                }
              </span>
              <ChevronDown className={`h-3 w-3 text-white/30 ml-1 flex-shrink-0 transition-transform ${showBaseDropdown ? "rotate-180" : ""}`} />
            </button>
            {showBaseDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-white/10 rounded-xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
                <button
                  onClick={() => { setSelectedBase(null); setShowBaseDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-[11px] flex justify-between transition-colors hover:bg-[#0d0d0d] ${selectedBase === null ? "font-semibold text-white" : "text-white/55"}`}
                  data-testid="btn-base-all"
                >
                  <span>All Bases</span>
                  <span className="text-white/30 font-mono">{(bases ?? []).reduce((s: number, b: any) => s + (b.count ?? 0), 0)}</span>
                </button>
                {(bases ?? []).map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedBase(b.id); setShowBaseDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-[11px] flex justify-between border-t border-white/[0.06] transition-colors hover:bg-[#0d0d0d] ${selectedBase === b.id ? "font-semibold text-white" : "text-white/55"}`}
                    data-testid={`btn-base-${b.id}`}
                  >
                    <span className="truncate pr-2">{b.name}</span>
                    <span className="text-white/30 font-mono shrink-0">{b.count ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filters button */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-lg border text-[11px] font-medium transition-colors ${
              showFilters || activeFilters > 0
                ? "bg-white/10 border-white/20 text-white"
                : "bg-[#0d0d0d] border-white/10 text-white/50 hover:text-white/70"
            }`}
            data-testid="btn-toggle-filters"
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="space-y-2 bg-[#0d0d0d] border border-white/10 rounded-xl p-2.5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-1">ZIP Code</p>
              <input
                type="text"
                placeholder="Enter ZIP..."
                value={zipSearch}
                onChange={e => setZipSearch(e.target.value)}
                className="w-full h-7 bg-[#111] border border-white/10 rounded-lg px-2.5 text-[11px] text-white/90 placeholder:text-white/35 outline-none focus:border-white/15"
                data-testid="input-zip"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-1">Bank</p>
                <select
                  value={selectedBank}
                  onChange={e => setSelectedBank(e.target.value)}
                  className="w-full h-7 bg-[#111] border border-white/10 rounded-lg px-2 text-[11px] text-white/70 outline-none"
                >
                  <option value="">All Banks</option>
                  {availableBanks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-1">Country</p>
                <select
                  value={selectedCountry}
                  onChange={e => setSelectedCountry(e.target.value)}
                  className="w-full h-7 bg-[#111] border border-white/10 rounded-lg px-2 text-[11px] text-white/70 outline-none"
                >
                  <option value="">All</option>
                  {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-1.5 items-center">
              <input type="number" step="0.01" placeholder="Min $" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                className="flex-1 h-7 bg-[#111] border border-white/10 rounded-lg px-2.5 text-[11px] text-white/90 placeholder:text-white/35 outline-none"
                data-testid="input-price-min"
              />
              <span className="text-white/30 text-[11px] shrink-0">—</span>
              <input type="number" step="0.01" placeholder="Max $" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                className="flex-1 h-7 bg-[#111] border border-white/10 rounded-lg px-2.5 text-[11px] text-white/90 placeholder:text-white/35 outline-none"
                data-testid="input-price-max"
              />
            </div>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-[10px] text-red-400/70 hover:text-red-400 transition-colors">
                <X className="h-3 w-3" /> Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Buy Selected button */}
        <button
          onClick={purchaseCart}
          disabled={cartCardIds.size === 0 || !!cartPurchasing}
          className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border text-[11px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: cartCardIds.size > 0 ? "hsl(112 45% 42% / 0.08)" : "rgba(255,255,255,0.03)",
            borderColor: cartCardIds.size > 0 ? "hsl(112 45% 42% / 0.3)" : "rgba(255,255,255,0.08)",
            color: cartCardIds.size > 0 ? "hsl(112 45% 42%)" : "rgba(255,255,255,0.25)",
          }}
          data-testid="btn-add-selected"
        >
          {cartPurchasing && !cartPurchasing.done ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Purchasing {cartPurchasing.current}/{cartPurchasing.total}...
            </>
          ) : (
            <>
              <ShoppingCart className="h-3 w-3" />
              Buy Selected ({cartCardIds.size}){cartCardIds.size > 0 ? ` · $${(cartTotal / 100).toFixed(2)}` : ""}
            </>
          )}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-[#0a0a0a]">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-4 w-4 animate-spin text-white/30" />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="py-12 text-center text-xs text-white/35">No cards available</div>
        ) : (
          <table className="w-full text-xs border-collapse" style={{ minWidth: "520px" }}>
            <thead>
              <tr className="border-b border-white/10">
                <th className="w-8 px-2.5 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={filteredCards.length > 0 && cartCardIds.size === filteredCards.length}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-white/15 cursor-pointer accent-red-500"
                    data-testid="checkbox-all"
                  />
                </th>
                <th className="px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/35">BIN</th>
                <th className="px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/35">BASE</th>
                <th className="px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/35">TYPE</th>
                <th className="px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/35">BANK</th>
                <th className="px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/35">ZIP</th>
                <th className="px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/35">Country</th>
                <th className="px-2.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-white/35">$</th>
                <th className="px-2.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-white/35">BUY</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((card: any) => (
                <CardTableRow
                  key={card.id}
                  card={card}
                  inCart={cartCardIds.has(card.id)}
                  onToggleCart={toggleCart}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CardTableRow({ card, inCart, onToggleCart }: { card: any; inCart: boolean; onToggleCart: (c: any) => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const bin = extractBin(card.cardNumber);
  const zip = extractZip(card.extras ?? "");
  const flag = countryFlag(card.binData?.countryCode ?? "");
  const ccCountry = countryName(card.binData?.countryCode ?? "");
  const cardType = formatType(card.binData);
  const bank = formatBank(card.binData);

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cards/${card.id}/purchase`, {});
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Purchase failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Purchase complete", description: "Card delivered to your orders" });
      setLocation("/orders");
    },
    onError: (e: Error) => toast({ title: "Purchase failed", description: e.message, variant: "destructive" }),
  });

  return (
    <tr
      className={`border-b border-white/[0.06] transition-colors ${inCart ? "bg-primary/[0.04]" : "hover:bg-white/[0.02]"}`}
      data-testid={`card-row-${card.id}`}
    >
      <td className="px-2.5 py-2">
        <input
          type="checkbox"
          checked={inCart}
          onChange={() => onToggleCart(card)}
          className="w-3.5 h-3.5 rounded border-white/15 cursor-pointer accent-red-500"
          data-testid={`checkbox-card-${card.id}`}
        />
      </td>
      <td className="px-2.5 py-2">
        <span className="font-bold font-mono text-xs text-white">{bin || "—"}</span>
      </td>
      <td className="px-2.5 py-2 max-w-[100px]">
        <span className="text-[10px] text-white/50 truncate block">{card.baseName || "—"}</span>
      </td>
      <td className="px-2.5 py-2">
        <span className="text-[11px] font-mono text-white/55">{cardType || "—"}</span>
      </td>
      <td className="px-2.5 py-2 max-w-[120px]">
        <span className="text-[11px] text-white/55 truncate block">{bank || "—"}</span>
      </td>
      <td className="px-2.5 py-2">
        <span className="text-[11px] font-mono text-white/55">{zip || "—"}</span>
      </td>
      <td className="px-2.5 py-2">
        <span className="text-base leading-none">{flag || "—"}</span>
      </td>
      <td className="px-2.5 py-2 text-right">
        <span className="font-bold text-xs text-white">${(card.price / 100).toFixed(2)}</span>
      </td>
      <td className="px-2.5 py-2 text-right">
        <button
          onClick={() => purchaseMutation.mutate()}
          disabled={purchaseMutation.isPending}
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/50 transition-colors disabled:opacity-50"
          data-testid={`btn-buy-card-${card.id}`}
        >
          {purchaseMutation.isPending
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <ShoppingCart className="h-3 w-3" />
          }
        </button>
      </td>
    </tr>
  );
}
