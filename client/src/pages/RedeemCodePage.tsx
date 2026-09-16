import { FormEvent, useState } from "react";
import { CheckCircle2, Gift, Loader2, ShieldCheck, WalletCards } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/hooks/use-wallet";

type RedemptionResult = {
  amountAdded: number;
  newBalance: number;
};

export default function RedeemCodePage() {
  const { user } = useAuth();
  const { redeemCode } = useWallet();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RedemptionResult | null>(null);
  const [error, setError] = useState("");

  const displayedBalance = result?.newBalance ?? user?.balance ?? 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError("Enter a code to continue.");
      return;
    }

    setError("");
    redeemCode.mutate(normalizedCode, {
      onSuccess: (data) => {
        setResult(data);
        setCode("");
      },
      onError: (err) => {
        setResult(null);
        setError(err instanceof Error ? err.message : "Unable to redeem this code.");
      },
    });
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:py-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-white">Redeem Code</h1>
          <p className="mt-2 text-sm text-white/45">Add balance to your account.</p>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-[#111] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <WalletCards className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-white/55">Current balance</span>
          </div>
          <span className="font-mono text-lg font-bold text-white" data-testid="text-redeem-balance">
            ${(displayedBalance / 100).toFixed(2)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-[#111] p-4 sm:p-5">
          <label htmlFor="redeem-code" className="mb-2 block text-sm font-bold text-white">
            Balance code
          </label>
          <input
            id="redeem-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setError("");
              setResult(null);
            }}
            placeholder="VOUCH-XXXXXXXX"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded border border-white/10 bg-[#0a0a0a] px-3 font-mono text-sm tracking-wide text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/60"
            data-testid="input-redeem-code"
          />
          <p className="mt-2 text-xs text-white/35">Codes are case-insensitive and can only be used once.</p>

          {error && (
            <p className="mt-4 rounded border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          {result && (
            <div className="mt-4 rounded border border-red-500/25 bg-red-500/10 px-3 py-3" role="status">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
                <CheckCircle2 className="h-4 w-4" />
                Code redeemed successfully
              </div>
              <p className="mt-1 text-xs text-red-200/70">
                ${(result.amountAdded / 100).toFixed(2)} was added to your balance.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={redeemCode.isPending || !code.trim()}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="button-redeem-code"
          >
            {redeemCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {redeemCode.isPending ? "Redeeming..." : "Redeem code"}
          </button>
        </form>

        <div className="mt-4 flex gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-white/45">
            Balance codes are issued by admins. Once redeemed, the value is added directly to your account and the code cannot be used again.
          </p>
        </div>
      </div>
    </div>
  );
}