import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2, Copy, Check, Clock, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ExternalLink, Send, Minus, Plus, ChevronDown
} from "lucide-react";
import { SiBitcoin, SiCashapp } from "react-icons/si";
import { formatDate } from "@/lib/date-utils";

type ManualMethod = "cashapp" | "venmo" | "zelle" | "chime";
type Method = "crypto" | ManualMethod;

type Deposit = {
  id: string;
  type: string;
  amount: number;
  status: string;
  paymentId?: string;
  checkoutUrl?: string;
  paymentNote?: string;
  createdAt: string;
};

type ManualResult = { note: string; handle: string; amount: number; method: Method };
type ManualMethodConfig = { enabled: boolean; handle?: string; tag?: string; fee: number };

function LetterIcon({ letter, className = "", style }: { letter: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`flex items-center justify-center font-black ${className}`} style={style}>{letter}</span>;
}

const BONUS_TIERS = [
  { min: 100,  max: 249,  bonus: "+10%", example: "$100 → $110"     },
  { min: 250,  max: 499,  bonus: "+13%", example: "$250 → $282.50"  },
  { min: 500,  max: 999,  bonus: "+16%", example: "$500 → $580"     },
  { min: 1000, max: 2499, bonus: "+20%", example: "$1,000 → $1,200" },
  { min: 2500, max: 4999, bonus: "+25%", example: "$2,500 → $3,125" },
  { min: 5000, max: null, bonus: "+30%", example: "$5,000 → $6,500" },
];

const CRYPTO_COINS = ["Bitcoin", "Ethereum", "Litecoin", "Solana", "Tether"];
const CRYPTO_NETWORKS: Record<string, string[]> = {
  Bitcoin: ["Bitcoin"],
  Ethereum: ["ERC20"],
  Litecoin: ["Litecoin"],
  Solana: ["Solana"],
  Tether: ["ERC20", "TRC20", "BEP20"],
};

function methodColor(type: string) {
  if (type === "cashapp") return "#00D632";
  if (type === "venmo") return "#3D95CE";
  if (type === "zelle") return "#9B59E8";
  if (type === "chime") return "#00D632";
  return "#F7931A";
}
function methodLabel(type: string) {
  if (type === "cashapp") return "CashApp";
  if (type === "venmo") return "Venmo";
  if (type === "zelle") return "Zelle";
  if (type === "chime") return "Chime";
  return "Crypto";
}

function CopyBtn({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`flex items-center justify-center w-9 h-9 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-white/50 hover:text-white transition-colors flex-shrink-0 ${className}`}
      data-testid="btn-copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (["completed","delivering","fulfilled"].includes(status))
    return <span className="flex items-center gap-1 text-[10px] font-mono text-red-400"><CheckCircle2 className="h-3 w-3" />credited</span>;
  if (["failed","expired"].includes(status))
    return <span className="flex items-center gap-1 text-[10px] font-mono text-red-400/70"><XCircle className="h-3 w-3" />{status}</span>;
  if (status === "underpaid")
    return <span className="flex items-center gap-1 text-[10px] font-mono text-yellow-400/70"><AlertTriangle className="h-3 w-3" />underpaid</span>;
  return <span className="flex items-center gap-1 text-[10px] font-mono text-white/30 animate-pulse"><Clock className="h-3 w-3" />pending</span>;
}

function DepositRow({ deposit }: { deposit: Deposit }) {
  const isCredited = ["completed","delivering","fulfilled"].includes(deposit.status);
  const color = methodColor(deposit.type);
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
      isCredited ? "bg-red-950/10 border-red-900/15" :
      ["failed","expired"].includes(deposit.status) ? "bg-red-950/10 border-red-900/15" :
      "bg-white/[0.02] border-white/[0.05]"
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: `${color}18`, color }}>
          {deposit.type === "crypto" ? "₿" : deposit.type.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-bold text-white">
              {deposit.amount > 0 ? `$${(deposit.amount / 100).toFixed(2)}` : "pending"}
            </span>
            <StatusBadge status={deposit.status} />
          </div>
          <p className="text-[9px] text-white/20 font-mono">{methodLabel(deposit.type)} · {formatDate(deposit.createdAt)}</p>
        </div>
      </div>
      {deposit.checkoutUrl && !isCredited && (
        <a href={deposit.checkoutUrl} target="_blank" rel="noopener noreferrer" className="ml-2 flex-shrink-0 text-white/20 hover:text-white/60 transition-colors">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}


/* ── MANUAL DEPOSIT PANEL ── */
function ManualDepositPanel({ result, onReset }: { result: ManualResult; onReset: () => void }) {
  const color = methodColor(result.method);
  const name = methodLabel(result.method);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${color}30`, background: `${color}06` }}>
      <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: `${color}20` }}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: color }}>
          {name.charAt(0)}
        </div>
        <p className="text-xs font-bold" style={{ color }}>Send via {name}</p>
      </div>
      <div className="p-3 space-y-2">
        <div className="rounded-lg bg-black/30 border border-white/5 px-3 py-2">
          <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1 font-mono">Send to</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-white font-mono truncate">{result.handle || `(no handle set)`}</p>
            {result.handle && <CopyBtn value={result.handle} />}
          </div>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/5 px-3 py-2">
          <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1 font-mono">Amount — send EXACTLY</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl font-black text-white font-mono">${(result.amount / 100).toFixed(2)}</p>
            <CopyBtn value={(result.amount / 100).toFixed(2)} />
          </div>
          <p className="text-[9px] text-yellow-400/60 font-mono mt-1">⚠ Wrong amount = not credited</p>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/5 px-3 py-2">
          <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1 font-mono">Payment Note (required)</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold font-mono" style={{ color }}>{result.note}</p>
            <CopyBtn value={result.note} />
          </div>
        </div>
        <p className="text-[9px] text-white/20 font-mono text-center">include the exact note · admin will confirm and credit balance</p>
        <button onClick={onReset} className="w-full text-[10px] text-white/25 hover:text-white/50 transition-colors font-mono pt-1" data-testid="btn-new-deposit">
          ← create new deposit
        </button>
      </div>
    </div>
  );
}
/* ══════════════════════════════════════════════
   MAIN DEPOSIT PAGE
══════════════════════════════════════════════ */
export default function DepositPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedOption, setSelectedOption] = useState<string | null>("crypto");
  const [amountInput, setAmountInput] = useState("");
  const [cryptoCoin, setCryptoCoin] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("");
  const [manualResult, setManualResult] = useState<ManualResult | null>(null);

  const { data: paymentMethods } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/payment-methods"],
  });

  const { data: manualMethods } = useQuery<{
    cashapp: ManualMethodConfig;
    venmo: ManualMethodConfig;
    zelle: ManualMethodConfig;
    chime: ManualMethodConfig;
  }>({ queryKey: ["/api/site-settings/manual-payments"] });

  const { data: minDeposits } = useQuery<Record<string, number>>({
    queryKey: ["/api/site-settings/min-deposits"],
  });

  const { data: deposits, refetch: refetchDeposits } = useQuery<Deposit[]>({
    queryKey: ["/api/deposits"],
    enabled: !!user,
    refetchInterval: 20000,
  });

  const cashappEnabled = paymentMethods?.cashapp !== false && manualMethods?.cashapp.enabled !== false;
  const venmoEnabled = paymentMethods?.venmo === true && manualMethods?.venmo.enabled === true;
  const zelleEnabled = paymentMethods?.zelle === true && manualMethods?.zelle.enabled === true;
  const chimeEnabled = paymentMethods?.chime === true && manualMethods?.chime.enabled === true;

  const parsedAmount = parseFloat(amountInput) || 0;
  const minimumDeposit = selectedOption === "crypto"
    ? Math.max(1, minDeposits?.crypto ?? 0)
    : Math.max(0.01, minDeposits?.[selectedOption as ManualMethod] ?? 0.01);

  const recentDeposits = deposits?.slice(0, 15) ?? [];

  /* ── Crypto mutation ── */
  const cryptoMutation = useMutation({
    mutationFn: async () => {
      const amount = parsedAmount;
      const cryptoMin = Math.max(1, minDeposits?.crypto ?? 0);
      if (!amount || amount < cryptoMin) throw new Error(`Minimum deposit is $${cryptoMin.toFixed(2)}`);
      const res = await apiRequest("POST", "/api/payments/crypto/create", {
        amount: String(Math.round(amount * 100)),
        purpose: "deposit",
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/deposits"] });
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Error", description: "Payment provider did not return a checkout link.", variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  /* ── Manual mutations ── */
  async function createManual(method: ManualMethod) {
    const amount = parsedAmount;
    if (!amount || amount < 0.01) throw new Error("Enter the amount you want to deposit");
    const min = minDeposits?.[method] ?? 0;
    if (min > 0 && amount < min) throw new Error(`Minimum deposit for ${methodLabel(method)} is $${min.toFixed(2)}`);
    const endpoint = method === "cashapp" ? "/api/orders/cashapp" : `/api/deposits/${method}`;
    const res = await apiRequest("POST", endpoint, { amount });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Unable to create ${methodLabel(method)} deposit`);
    }
    return res.json();
  }

  const manualMutation = useMutation({
    mutationFn: (method: ManualMethod) => createManual(method),
    onSuccess: (data, method) => {
      const config = manualMethods?.[method];
      setManualResult({
        note: data.paymentNote,
        handle: data.cashappTag || data.handle || config?.tag || config?.handle || "",
        amount: Math.round(parsedAmount * 100),
        method,
      });
      qc.invalidateQueries({ queryKey: ["/api/deposits"] });
      qc.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const isPending = cryptoMutation.isPending || manualMutation.isPending;

  function feeLabel(fee: number | undefined) {
    if (!fee || fee === 0) return "0% fee";
    return `${fee}% fee`;
  }

  const paymentOptions = [
    { id: "crypto", label: "Crypto", sub: "BTC · ETH · LTC · SOL · USDT", Icon: SiBitcoin, color: "#F7931A", fee: "0% fee" },
    ...(cashappEnabled ? [{ id: "cashapp", label: "CashApp", sub: "instant", Icon: SiCashapp, color: "#00D632", fee: feeLabel(manualMethods?.cashapp?.fee) }] : []),
    ...(venmoEnabled ? [{ id: "venmo", label: "Venmo", sub: "instant", Icon: (props: any) => <LetterIcon {...props} letter="V" />, color: "#3D95CE", fee: feeLabel(manualMethods?.venmo?.fee) }] : []),
    ...(zelleEnabled ? [{ id: "zelle", label: "Zelle", sub: "instant", Icon: (props: any) => <LetterIcon {...props} letter="Z" />, color: "#9B59E8", fee: feeLabel(manualMethods?.zelle?.fee) }] : []),
    ...(chimeEnabled ? [{ id: "chime", label: "Chime", sub: "instant", Icon: (props: any) => <LetterIcon {...props} letter="C" />, color: "#00D632", fee: feeLabel(manualMethods?.chime?.fee) }] : []),
  ];

  const isSelectedCrypto = selectedOption === "crypto";

  function adjustAmount(delta: number) {
    const next = Math.max(0, Math.round((parsedAmount + delta) * 100) / 100);
    setAmountInput(next > 0 ? next.toFixed(2) : "");
  }

  function handleContinue() {
    if (!selectedOption) return;
    if (isSelectedCrypto) cryptoMutation.mutate();
    else if (["cashapp", "venmo", "zelle", "chime"].includes(selectedOption)) {
      manualMutation.mutate(selectedOption as ManualMethod);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-3">

        {/* ── Page heading ── */}
        <div className="pt-1 pb-0.5 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Deposit</h1>
          <p className="text-sm text-white/50">Deposit funds to your account</p>
        </div>

        {manualResult ? (
          <ManualDepositPanel result={manualResult} onReset={() => { setManualResult(null); setSelectedOption("crypto"); setAmountInput(""); }} />
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#181818] p-3 sm:p-4 space-y-3">
            {/* ── Payment method ── */}
            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map(opt => {
                const isActive = selectedOption === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedOption(opt.id);
                      if (opt.id !== "crypto") {
                        setCryptoCoin("");
                        setCryptoNetwork("");
                      }
                    }}
                    className={`min-h-10 flex items-center justify-center gap-2 rounded-lg border px-2 text-xs sm:text-sm font-semibold transition-all ${
                      isActive
                        ? "border-white/80 bg-[#f1f1f1] text-black"
                        : "border-white/15 bg-[#0d0d0d] text-white hover:border-white/35"
                    }`}
                    data-testid={`btn-payment-${opt.id}`}
                  >
                    {opt.id === "crypto" ? (
                      <span className="text-lg leading-none" aria-hidden="true">🪙</span>
                    ) : (
                      <opt.Icon className="h-5 w-5 flex-shrink-0" style={{ color: opt.color }} />
                    )}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {isSelectedCrypto && (
              <>
                {/* ── Coin ── */}
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-white">Coin</span>
                  <span className="relative block">
                    <select
                      value={cryptoCoin}
                      onChange={e => { setCryptoCoin(e.target.value); setCryptoNetwork(""); }}
                      className="appearance-none w-full h-10 rounded-lg border border-white/15 bg-[#202020] px-3 pr-8 text-sm text-white outline-none focus:border-white/40 transition-colors"
                      data-testid="select-crypto-coin"
                    >
                      <option value="">Select coin...</option>
                      {CRYPTO_COINS.map(coin => <option key={coin} value={coin}>{coin}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  </span>
                </label>

                {/* ── Network ── */}
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-white">Network</span>
                  <span className="relative block">
                    <select
                      value={cryptoNetwork}
                      onChange={e => setCryptoNetwork(e.target.value)}
                      disabled={!cryptoCoin}
                      className="appearance-none w-full h-10 rounded-lg border border-white/15 bg-[#202020] px-3 pr-8 text-sm text-white outline-none focus:border-white/40 transition-colors disabled:text-white/35 disabled:cursor-not-allowed"
                      data-testid="select-crypto-network"
                    >
                      <option value="">Select network...</option>
                      {(CRYPTO_NETWORKS[cryptoCoin] ?? []).map(network => <option key={network} value={network}>{network}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  </span>
                </label>
              </>
            )}

            {/* ── Amount ── */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Amount (USD)</p>
              <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustAmount(-1)}
                  className="h-10 rounded-lg border border-white/10 bg-[#202020] text-lg text-white/60 hover:text-white hover:border-white/30 transition-colors"
                  aria-label="Decrease amount"
                >
                  <Minus className="h-4 w-4 mx-auto" />
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="15.00"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  className="w-full h-10 rounded-lg border border-white/15 bg-[#202020] px-3 text-center text-sm text-white outline-none focus:border-white/40 transition-colors placeholder:text-white/45"
                  data-testid="input-amount"
                />
                <button
                  type="button"
                  onClick={() => adjustAmount(1)}
                  className="h-10 rounded-lg border border-white/10 bg-[#202020] text-lg text-white/70 hover:text-white hover:border-white/30 transition-colors"
                  aria-label="Increase amount"
                >
                  <Plus className="h-4 w-4 mx-auto" />
                </button>
              </div>
              <p className="text-sm text-white/50">Minimum deposit: ${minimumDeposit.toFixed(2)}</p>
            </div>

            {/* ── Create deposit ── */}
            <button
              onClick={handleContinue}
              disabled={!selectedOption || isPending || !amountInput || parsedAmount <= 0}
              className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              data-testid="btn-continue-deposit"
            >
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : "Create Deposit"}
            </button>
          </div>
        )}

        {/* ── History ── */}
        {recentDeposits.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">Deposit History</p>
              <button onClick={() => refetchDeposits()} className="text-white/20 hover:text-white/50 transition-colors" data-testid="btn-refresh-deposits">
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {recentDeposits.map(dep => <DepositRow key={dep.id} deposit={dep} />)}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-white/8 py-6 px-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-5 text-xs font-semibold text-white/50 tracking-widest uppercase">
          <span>Reviews</span>
          <a href="https://t.me/+3-lMkt-idutkOTIx" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center h-5 w-5 rounded-full bg-primary">
            <Send className="h-2.5 w-2.5 text-white fill-white" />
          </a>
          <span>TOS</span>
          <span>FAQs</span>
        </div>
      </div>
    </div>
  );
}
