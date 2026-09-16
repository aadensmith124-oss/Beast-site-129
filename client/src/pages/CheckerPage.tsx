import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle, XCircle, CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";

function parseCardLine(line: string): { number: string; date: string; cvv: string; details?: string[] } | null {
  const cleaned = line.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/[|:,\s]+/).filter(Boolean);
  if (parts.length < 3) return null;
  return { number: parts[0], date: parts[1], cvv: parts[2], details: parts.slice(3) };
}

export default function CheckerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [hasChecked, setHasChecked] = useState(false);

  const cards = useMemo(() => {
    return input
      .split("\n")
      .map(parseCardLine)
      .filter(Boolean) as { number: string; date: string; cvv: string }[];
  }, [input]);

  const totalCost = cards.length * 0.15;
  const balance = (user?.balance ?? 0) / 100;

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/checker/check", { cards });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Check failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResults(data.results);
      setHasChecked(true);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const approved = data.results.filter((r: any) => r.status === "approved").length;
      const declined = data.results.filter((r: any) => r.status === "declined").length;
      toast({
        title: `Check complete`,
        description: `${approved} approved · ${declined} declined`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const approved = results.filter(r => r.status === "approved");
  const declined = results.filter(r => r.status === "declined");

  const canCheck = cards.length > 0 && balance >= totalCost && !checkMutation.isPending;

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-20">
      <div className="max-w-lg w-full mx-auto px-4 pt-6 space-y-5">

        {/* ── Hero ── */}
        <div className="text-center pt-2 pb-2 space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black text-primary tracking-wide uppercase">TurtleCC</h1>
          <p className="text-sm text-white/50">Providing high quality cards since 2026.</p>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-white">Card Checker</h1>
          </div>
          <p className="text-xs text-white/45">Enter cards below — <span className="text-primary font-mono">$0.15</span> per card checked</p>
        </div>

        {/* Balance row */}
        <div className="flex items-center justify-between bg-[#111]/3 border border-white/10 rounded-xl px-4 py-3">
          <span className="text-xs text-white/45">Your balance</span>
          <span className="text-sm font-mono font-bold text-white">${balance.toFixed(2)}</span>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/45 font-mono">number | date | cvv | address | city | state | zip (one per line)</label>
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
            onChange={e => { setInput(e.target.value); setHasChecked(false); setResults([]); }}
            placeholder={"4111111111111111 | 01/27 | 123\n5500005555555559 | 06/28 | 456\n378282246310005 | 09/26 | 7890"}
            rows={7}
            className="bg-[#111]/5 border-white/10 font-mono text-xs text-white/70 placeholder:text-white/30 resize-none focus:border-primary/40"
            data-testid="textarea-checker-input"
          />
        </div>

        {/* Cost summary */}
        {cards.length > 0 && (
          <div className="bg-[#111]/3 border border-white/10 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/45">Cards detected</span>
              <span className="font-mono text-white font-bold">{cards.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/45">Cost per card</span>
              <span className="font-mono text-white/60">$0.10</span>
            </div>
            <div className="border-t border-white/10 pt-1.5 flex justify-between text-xs">
              <span className="text-white/60 font-semibold">Total cost</span>
              <span className={`font-mono font-bold ${balance < totalCost ? "text-red-400" : "text-primary"}`}>
                ${totalCost.toFixed(2)}
              </span>
            </div>
            {balance < totalCost && (
              <p className="text-[10px] text-red-400/80 pt-0.5">Insufficient balance — deposit more funds first</p>
            )}
          </div>
        )}

        {/* Check button */}
        <Button
          className="w-full h-11 font-bold text-sm"
          onClick={() => checkMutation.mutate()}
          disabled={!canCheck}
          data-testid="btn-check-cards"
        >
          {checkMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking {cards.length} card{cards.length !== 1 ? "s" : ""}…
            </>
          ) : (
            `Check ${cards.length > 0 ? cards.length : ""} Card${cards.length !== 1 ? "s" : ""} — $${totalCost.toFixed(2)}`
          )}
        </Button>

        {/* Results */}
        {hasChecked && results.length > 0 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex gap-3">
              <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-red-400">{approved.length}</p>
                <p className="text-[10px] text-red-400/70 font-semibold uppercase tracking-wide mt-0.5">Approved</p>
              </div>
              <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-red-400">{declined.length}</p>
                <p className="text-[10px] text-red-400/70 font-semibold uppercase tracking-wide mt-0.5">Declined</p>
              </div>
            </div>

            {/* Approved cards */}
            {approved.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest">✓ Approved</p>
                {approved.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3"
                    data-testid={`result-approved-${i}`}
                  >
                    <CheckCircle className="h-4 w-4 text-red-400 shrink-0" />
                    <p className="text-xs font-mono text-white/70 break-all">
                      {r.number} | {r.date} | {r.cvv}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Declined cards */}
            {declined.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest">✗ Declined</p>
                {declined.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3"
                    data-testid={`result-declined-${i}`}
                  >
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white/60 break-all">
                        {r.number} | {r.date} | {r.cvv}
                      </p>
                      {r.error && (
                        <p className="text-[10px] text-red-400/60 mt-0.5 truncate">{r.error}</p>
                      )}
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
