import { useMemo, useState } from "react";
import { CircleDot, Loader2, ShieldCheck } from "lucide-react";
import { useGames } from "@/hooks/use-games";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MULTIPLIERS = [3, 2.2, 1.3, 0.9, 0.45, 0.9, 1.3, 2.2, 3];
const ROWS = 8;

type PlinkoResult = {
  path: number[];
  slot: number;
  multiplier: number;
  payout: number;
  profit: number;
  newBalance: number;
};

function formatMultiplier(value: number) {
  return `${value}x`;
}

export default function PlinkoPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { playPlinko } = useGames();
  const [bet, setBet] = useState(100);
  const [result, setResult] = useState<PlinkoResult | null>(null);

  const balance = (user?.balance ?? 0) / 100;
  const betDollars = bet / 100;
  const pathPoints = useMemo(() => {
    if (!result) return "";
    let x = 210;
    const points = [`${x},18`];
    result.path.forEach((step, index) => {
      x += step === 0 ? -24 : 24;
      points.push(`${x},${48 + index * 30}`);
    });
    return points.join(" ");
  }, [result]);

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please login to play.</div>;
  }

  const handlePlay = () => {
    setResult(null);
    playPlinko.mutate(Math.round(bet), {
      onSuccess: (data) => {
        setResult(data);
        queryClient.setQueryData([api.auth.me.path], (old: any) => ({ ...old, balance: data.newBalance }));
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="border-primary/20 bg-[#0f1115] overflow-hidden">
        <CardHeader className="text-center border-b border-white/5 bg-[#111]/5">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CircleDot className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl font-black italic tracking-tighter uppercase text-white">Plinko</CardTitle>
          <CardDescription>Drop through 8 fair rows. The payout table and house edge are shown below.</CardDescription>
        </CardHeader>

        <CardContent className="p-5 sm:p-8 space-y-7">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-5">
            <svg viewBox="0 0 420 285" className="mx-auto block w-full max-w-[420px]" role="img" aria-label="Plinko board">
              {Array.from({ length: ROWS }).map((_, row) =>
                Array.from({ length: row + 1 }).map((__, peg) => {
                  const y = 48 + row * 30;
                  const x = 210 + (peg - row / 2) * 48;
                  return <circle key={`${row}-${peg}`} cx={x} cy={y} r="3.5" fill="hsl(38 95% 55% / 0.75)" />;
                }),
              )}
              {result && (
                <polyline
                  points={pathPoints}
                  fill="none"
                  stroke="hsl(188 84% 44%)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {result && (
                <circle
                  cx={210 + (result.slot - 4) * 24}
                  cy="270"
                  r="8"
                  fill="hsl(188 84% 44%)"
                  stroke="white"
                  strokeWidth="2"
                />
              )}
              <line x1="18" y1="254" x2="402" y2="254" stroke="rgba(255,255,255,0.12)" />
            </svg>
            <div className="grid grid-cols-9 gap-1 mt-2">
              {MULTIPLIERS.map((multiplier, index) => (
                <div
                  key={multiplier + index}
                  className={cn(
                    "rounded-md px-1 py-1.5 text-center text-[10px] font-bold font-mono",
                    result?.slot === index
                      ? "bg-primary text-primary-foreground"
                      : multiplier < 1
                        ? "bg-red-500/15 text-red-300"
                        : "bg-emerald-500/15 text-emerald-300",
                  )}
                >
                  {formatMultiplier(multiplier)}
                </div>
              ))}
            </div>
          </div>

          {result && (
            <div className={cn(
              "rounded-xl border px-4 py-3 text-center",
              result.profit >= 0
                ? "border-emerald-500/25 bg-emerald-500/10"
                : "border-red-500/25 bg-red-500/10",
            )}>
              <p className="text-2xl font-black text-white">{formatMultiplier(result.multiplier)}</p>
              <p className={cn("text-sm font-semibold", result.profit >= 0 ? "text-emerald-300" : "text-red-300")}>
                {result.profit >= 0 ? "+" : ""}${(result.profit / 100).toFixed(2)} net · ${(result.payout / 100).toFixed(2)} returned
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-xs text-white/40">Balance</p>
              <p className="mt-1 font-mono font-bold text-white">${balance.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-xs text-white/40">Bet</p>
              <p className="mt-1 font-mono font-bold text-white">${betDollars.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
              <Input
                type="number"
                min="0.01"
                max="1000"
                step="0.01"
                value={Number.isFinite(betDollars) ? betDollars : ""}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setBet(Number.isFinite(value) ? Math.max(1, Math.round(value * 100)) : 0);
                }}
                className="pl-8 text-center font-mono text-xl bg-black/40 border-white/10 h-14"
                aria-label="Bet amount in dollars"
              />
            </div>
            <Button
              size="lg"
              className="sm:w-40 h-14 bg-primary hover:bg-primary/90 text-white font-black italic tracking-tighter uppercase text-xl"
              onClick={handlePlay}
              disabled={playPlinko.isPending || bet < 1 || bet > 100000 || bet > (user.balance ?? 0)}
            >
              {playPlinko.isPending ? <Loader2 className="animate-spin h-6 w-6" /> : "DROP"}
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-white/55">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Every row uses a server-side 50/50 step. This published table has a theoretical return of approximately
                <span className="font-bold text-white"> 96.2%</span> (about a 3.8% house edge). Results are not manually adjusted.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}