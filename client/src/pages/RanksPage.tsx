import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";

const RANKS = [
  { key: "newbie",  label: "Newbie",  emoji: "🌱", color: "text-white/45",   bar: "#ffffff40", border: "border-white/10",     glow: "",                     discount: 0,  threshold: 0,      next: 10000  },
  { key: "regular", label: "Regular", emoji: "⭐", color: "text-blue-400",   bar: "#60a5fa",   border: "border-blue-500/30",  glow: "shadow-blue-500/10",   discount: 2,  threshold: 10000,  next: 50000  },
  { key: "vip",     label: "VIP",     emoji: "💎", color: "text-purple-400", bar: "#c084fc",   border: "border-purple-500/30",glow: "shadow-purple-500/10", discount: 5,  threshold: 50000,  next: 100000 },
  { key: "nyc",     label: "Silverback", emoji: "🫆", color: "text-amber-400", bar: "#fbbf24", border: "border-amber-500/30", glow: "shadow-amber-500/10", discount: 10, threshold: 100000, next: null   },
];

function getRankIdx(totalDeposited: number) {
  if (totalDeposited >= 100000) return 3;
  if (totalDeposited >= 50000)  return 2;
  if (totalDeposited >= 10000)  return 1;
  return 0;
}

export default function RanksPage() {
  const [, setLocation] = useLocation();
  const { data: rankData, isLoading } = useQuery<any>({ queryKey: ["/api/user/rank"] });

  const totalDeposited = rankData?.totalDeposited ?? 0;
  const currentIdx = getRankIdx(totalDeposited);
  const current = RANKS[currentIdx];
  const next = RANKS[currentIdx + 1] ?? null;
  const progress = next
    ? Math.min(100, Math.round(((totalDeposited - current.threshold) / (next.threshold - current.threshold)) * 100))
    : 100;

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-20">
      <div className="max-w-md sm:max-w-2xl lg:max-w-3xl mx-auto px-4 pt-6">

        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setLocation("/profile")}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-[#0d0d0d] hover:bg-[#111]/5 transition-colors text-white/45 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Ranks</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">deposit more, save more</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Current rank hero */}
            <div className={`rounded-2xl border ${current.border} bg-[#0d0d0d] p-5 mb-6 shadow-lg ${current.glow}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{current.emoji}</span>
                  <div>
                    <p className={`text-lg font-bold ${current.color}`}>{current.label}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">your rank</p>
                  </div>
                </div>
                <div className="text-right">
                  {current.discount > 0 ? (
                    <>
                      <p className={`text-2xl font-bold ${current.color}`}>{current.discount}%</p>
                      <p className="text-[10px] text-white/40">off every order</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-white/30">—</p>
                      <p className="text-[10px] text-white/40">no discount yet</p>
                    </>
                  )}
                </div>
              </div>

              {next ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>${(totalDeposited / 100).toFixed(0)} deposited</span>
                    <span>${(next.threshold / 100).toFixed(0)} for {next.label} {next.emoji}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#0d0d0d] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progress}%`, backgroundColor: current.bar }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30">
                    ${((next.threshold - totalDeposited) / 100).toFixed(0)} more to unlock {next.discount}% discount
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-amber-400/60 mt-2">Max rank reached — {current.discount}% discount on every order automatically</p>
              )}
            </div>

            {/* All tiers */}
            <div className="space-y-2">
              <p className="text-[9px] text-white/30 uppercase tracking-widest mb-3">All Tiers</p>
              {RANKS.map((rank, i) => {
                const isUnlocked = i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <div
                    key={rank.key}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? `${rank.border} bg-[#0d0d0d]`
                        : isUnlocked
                        ? "border-white/10 bg-[#0d0d0d]"
                        : "border-white/10 bg-transparent opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-7 text-center">{rank.emoji}</span>
                      <div>
                        <p className={`text-sm font-bold ${isUnlocked ? rank.color : "text-white/40"}`}>
                          {rank.label}
                          {isCurrent && <span className="ml-2 text-[9px] font-normal text-white/40 uppercase tracking-widest">current</span>}
                        </p>
                        <p className="text-[10px] text-white/30">
                          {rank.threshold === 0 ? "Default" : `$${(rank.threshold / 100).toFixed(0)}+ deposited`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {rank.discount > 0 ? (
                        <span className={`text-sm font-bold ${isUnlocked ? rank.color : "text-white/30"}`}>{rank.discount}% off</span>
                      ) : (
                        <span className="text-sm text-white/30">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-white/30 text-center mt-6 leading-relaxed">
              Discounts apply automatically at checkout.<br />Based on your total lifetime deposits.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
