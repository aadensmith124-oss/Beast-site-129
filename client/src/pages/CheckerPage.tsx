import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle, XCircle, CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";

type CardInput = { number: string; date: string; cvv: string };
type TokenizedCard = { dataDescriptor: string; dataValue: string };
type CheckerResult = CardInput & { status: "approved" | "declined"; error?: string; voided?: boolean };
type CheckerConfig = {
  apiLoginId: string;
  clientKey: string;
  environment: "sandbox" | "production";
  scriptUrl: string;
};

type AcceptResponse = {
  messages?: { resultCode?: string; message?: Array<{ text?: string }> };
  opaqueData?: { dataDescriptor?: string; dataValue?: string };
};

type AcceptJs = {
  dispatchData: (
    secureData: {
      apiLoginID: string;
      clientKey: string;
      cardData: { cardNumber: string; month: string; year: string; cardCode: string };
    },
    callback: (response: AcceptResponse) => void,
  ) => void;
};

declare global {
  interface Window {
    Accept?: AcceptJs;
  }
}

const COST_PER_CARD = 0.15;

function parseCardLine(line: string): CardInput | null {
  const cleaned = line.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/[|:,\s]+/).filter(Boolean);
  if (parts.length < 3) return null;
  return { number: parts[0], date: parts[1], cvv: parts[2] };
}

function parseExpiry(date: string) {
  const match = date.trim().match(/^(\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) throw new Error("Invalid expiry date. Use MM/YY.");
  const month = Number(match[1]);
  if (month < 1 || month > 12) throw new Error("Invalid expiry month.");
  const year = match[2].length === 2 ? `20${match[2]}` : match[2];
  return { month: String(month).padStart(2, "0"), year };
}

function loadAcceptJs(scriptUrl: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.Accept) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-authorize-net-accept]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Authorize.net Accept.js")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.authorizeNetAccept = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Authorize.net Accept.js"));
    document.head.appendChild(script);
  });
}

function maskCardNumber(number: string) {
  const digits = number.replace(/\D/g, "");
  return `•••• ${digits.slice(-4)}`;
}

export default function CheckerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [results, setResults] = useState<CheckerResult[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [acceptReady, setAcceptReady] = useState(false);

  const configQuery = useQuery<CheckerConfig>({
    queryKey: ["/api/checker/config"],
    enabled: Boolean(user),
    retry: false,
  });

  useEffect(() => {
    if (!configQuery.data) return;
    let cancelled = false;
    loadAcceptJs(configQuery.data.scriptUrl)
      .then(() => { if (!cancelled) setAcceptReady(true); })
      .catch((error: Error) => {
        if (!cancelled) toast({ title: "Checker unavailable", description: error.message, variant: "destructive" });
      });
    return () => { cancelled = true; };
  }, [configQuery.data, toast]);

  const cards = useMemo(() => input.split("\n").map(parseCardLine).filter(Boolean) as CardInput[], [input]);
  const totalCost = cards.length * COST_PER_CARD;
  const balance = (user?.balance ?? 0) / 100;

  const tokenizeCard = (card: CardInput, config: CheckerConfig): Promise<TokenizedCard> => {
    return new Promise((resolve, reject) => {
      if (!window.Accept) {
        reject(new Error("Authorize.net Accept.js is still loading"));
        return;
      }
      const expiry = parseExpiry(card.date);
      window.Accept.dispatchData({
        apiLoginID: config.apiLoginId,
        clientKey: config.clientKey,
        cardData: {
          cardNumber: card.number.replace(/[\s-]/g, ""),
          month: expiry.month,
          year: expiry.year,
          cardCode: card.cvv.trim(),
        },
      }, (response) => {
        const message = response.messages?.message?.map(item => item.text).filter(Boolean).join("; ");
        if (response.messages?.resultCode === "Ok" && response.opaqueData?.dataDescriptor && response.opaqueData.dataValue) {
          resolve({
            dataDescriptor: response.opaqueData.dataDescriptor,
            dataValue: response.opaqueData.dataValue,
          });
          return;
        }
        reject(new Error(message || "Authorize.net could not tokenize this card"));
      });
    });
  };

  const checkMutation = useMutation({
    mutationFn: async () => {
      if (!configQuery.data) throw new Error("Authorize.net checker is not configured");
      const cardsToCheck = [...cards];
      const tokenizedCards: TokenizedCard[] = [];
      for (const card of cardsToCheck) {
        tokenizedCards.push(await tokenizeCard(card, configQuery.data));
      }
      const response = await apiRequest("POST", "/api/checker/check", { cards: tokenizedCards });
      return { data: await response.json(), cards: cardsToCheck };
    },
    onSuccess: ({ data, cards: checkedCards }) => {
      setResults(data.results.map((result: Omit<CheckerResult, keyof CardInput>, index: number) => ({
        ...checkedCards[index],
        ...result,
      })));
      setHasChecked(true);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const approved = data.results.filter((r: { status: string }) => r.status === "approved").length;
      const declined = data.results.filter((r: { status: string }) => r.status === "declined").length;
      toast({ title: "Check complete", description: `${approved} approved · ${declined} declined` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approved = results.filter(result => result.status === "approved");
  const declined = results.filter(result => result.status === "declined");
  const configured = Boolean(configQuery.data);
  const canCheck = configured
    && acceptReady
    && cards.length > 0
    && cards.length <= 10
    && balance >= totalCost
    && !checkMutation.isPending;

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-20">
      <div className="max-w-lg w-full mx-auto px-4 pt-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-white">Card Verification</h1>
          </div>
          <p className="text-xs text-white/45">
            Authorized cards only — <span className="text-primary font-mono">${COST_PER_CARD.toFixed(2)}</span> per verification
          </p>
        </div>

        <div className="flex items-center justify-between bg-[#111]/3 border border-white/10 rounded-xl px-4 py-3">
          <span className="text-xs text-white/45">Your balance</span>
          <span className="text-sm font-mono font-bold text-white">${balance.toFixed(2)}</span>
        </div>

        {!configured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200/80">
            The checker is not configured yet. Add the Authorize.net settings before using it.
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/45 font-mono">number | date | cvv (one per line, maximum 10)</label>
            {input && (
              <button
                onClick={() => { setInput(""); setResults([]); setHasChecked(false); }}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> clear
              </button>
            )}
          </div>
          <Textarea
            value={input}
            onChange={event => { setInput(event.target.value); setHasChecked(false); setResults([]); }}
            placeholder={"4111111111111111 | 01/27 | 123\n5500005555555559 | 06/28 | 456"}
            rows={7}
            className="bg-[#111]/5 border-white/10 font-mono text-xs text-white/70 placeholder:text-white/30 resize-none focus:border-primary/40"
            data-testid="textarea-checker-input"
          />
        </div>

        {cards.length > 0 && (
          <div className="bg-[#111]/3 border border-white/10 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/45">Cards detected</span>
              <span className="font-mono text-white font-bold">{cards.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/45">Cost per card</span>
              <span className="font-mono text-white/60">${COST_PER_CARD.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/10 pt-1.5 flex justify-between text-xs">
              <span className="text-white/60 font-semibold">Total cost</span>
              <span className={`font-mono font-bold ${balance < totalCost ? "text-red-400" : "text-primary"}`}>
                ${totalCost.toFixed(2)}
              </span>
            </div>
            {cards.length > 10 && <p className="text-[10px] text-red-400/80 pt-0.5">Maximum 10 cards per request.</p>}
            {balance < totalCost && <p className="text-[10px] text-red-400/80 pt-0.5">Insufficient balance — deposit more funds first</p>}
          </div>
        )}

        <Button
          className="w-full h-11 font-bold text-sm"
          onClick={() => checkMutation.mutate()}
          disabled={!canCheck}
          data-testid="btn-check-cards"
        >
          {checkMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying {cards.length} card{cards.length !== 1 ? "s" : ""}…</>
          ) : (
            `Verify ${cards.length > 0 ? cards.length : ""} Card${cards.length !== 1 ? "s" : ""} — $${totalCost.toFixed(2)}`
          )}
        </Button>

        {hasChecked && results.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-emerald-400">{approved.length}</p>
                <p className="text-[10px] text-emerald-400/70 font-semibold uppercase tracking-wide mt-0.5">Approved</p>
              </div>
              <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-red-400">{declined.length}</p>
                <p className="text-[10px] text-red-400/70 font-semibold uppercase tracking-wide mt-0.5">Declined</p>
              </div>
            </div>

            {approved.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">✓ Approved</p>
                {approved.map((result, index) => (
                  <div key={index} className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3" data-testid={`result-approved-${index}`}>
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <p className="text-xs font-mono text-white/70 break-all">{maskCardNumber(result.number)} | {result.date}</p>
                  </div>
                ))}
              </div>
            )}

            {declined.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest">✗ Declined</p>
                {declined.map((result, index) => (
                  <div key={index} className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3" data-testid={`result-declined-${index}`}>
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white/60 break-all">{maskCardNumber(result.number)} | {result.date}</p>
                      {result.error && <p className="text-[10px] text-red-400/60 mt-0.5 truncate">{result.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}