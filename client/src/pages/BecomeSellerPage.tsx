import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  BadgeCheck,
  Store,
  Zap,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";

const PERKS = [
  { icon: Store, label: "Own Storefront", desc: "List your products in the marketplace" },
  { icon: Zap, label: "Instant Delivery", desc: "Stock-based auto-delivery" },
  { icon: ShieldCheck, label: "Verified Badge", desc: "Trusted seller status" },
];

export default function BecomeSellerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: application, isLoading } = useQuery<any>({
    queryKey: ["/api/seller/me"],
    queryFn: async () => {
      const res = await fetch("/api/seller/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/seller/apply", { note });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/me"] });
      toast({ title: "Application submitted!", description: "We'll review your application shortly." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const copyCode = () => {
    if (application?.sellerCode) {
      navigator.clipboard.writeText(application.sellerCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-20">
      <div className="max-w-lg w-full mx-auto px-4 pt-6 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BadgeCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-white">Become a Seller</h1>
          </div>
          <p className="text-xs text-white/45">Apply to sell your products and reach our customer base</p>
        </div>

        {/* Perks — only show when not approved */}
        {application?.status !== "approved" && (
          <div className="grid grid-cols-3 gap-2">
            {PERKS.map((p) => (
              <div key={p.label} className="bg-[#111]/3 border border-white/6 rounded-xl p-3 text-center space-y-1.5">
                <p.icon className="h-4 w-4 text-primary mx-auto" />
                <p className="text-[11px] font-bold text-white">{p.label}</p>
                <p className="text-[10px] text-white/40 leading-tight">{p.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* === APPROVED === */}
        {application?.status === "approved" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-red-500/8 border border-red-500/25 rounded-2xl px-5 py-5">
              <CheckCircle2 className="h-8 w-8 text-red-400 shrink-0" />
              <div>
                <p className="text-base font-black text-red-400">You're an Approved Seller!</p>
                <p className="text-xs text-white/45 mt-0.5">Your application has been approved. Use your seller code below.</p>
              </div>
            </div>

            {application.sellerCode && (
              <div className="bg-[#111]/5 border border-white/10 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-white/45 uppercase tracking-widest">Your Seller Code</p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-black text-primary tracking-wider flex-1">
                    {application.sellerCode}
                  </span>
                  <button
                    onClick={copyCode}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#0d0d0d] border border-white/10 hover:bg-[#111]/5 transition-colors"
                    data-testid="btn-copy-seller-code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-red-400" /> : <Copy className="h-3.5 w-3.5 text-white/45" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === PENDING === */}
        {application?.status === "pending" && (
          <div className="flex items-center gap-4 bg-yellow-500/8 border border-yellow-500/25 rounded-2xl px-5 py-5">
            <Clock className="h-8 w-8 text-yellow-400 shrink-0" />
            <div>
              <p className="text-base font-black text-yellow-400">Application Under Review</p>
              <p className="text-xs text-white/45 mt-0.5">An admin is reviewing your application. We'll update you soon.</p>
            </div>
          </div>
        )}

        {/* === REJECTED — can reapply === */}
        {application?.status === "rejected" && (
          <div className="space-y-5">
            <div className="flex items-start gap-4 bg-red-900/15 border border-red-500/20 rounded-2xl px-5 py-5">
              <XCircle className="h-8 w-8 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-black text-red-400">Application Not Approved</p>
                {application.note ? (
                  <p className="text-xs text-white/45 mt-0.5">{application.note}</p>
                ) : (
                  <p className="text-xs text-white/45 mt-0.5">Your application wasn't approved this time. You may reapply below.</p>
                )}
              </div>
            </div>
            <ApplyForm note={note} setNote={setNote} onSubmit={() => applyMutation.mutate()} isPending={applyMutation.isPending} label="Reapply" />
          </div>
        )}

        {/* === NOT APPLIED === */}
        {!application && (
          <ApplyForm note={note} setNote={setNote} onSubmit={() => applyMutation.mutate()} isPending={applyMutation.isPending} label="Submit Application" />
        )}
      </div>
    </div>
  );
}

function ApplyForm({ note, setNote, onSubmit, isPending, label }: {
  note: string;
  setNote: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  label: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-white/45 block mb-1.5">Why do you want to sell here? <span className="text-white/40">(optional)</span></label>
        <Textarea
          placeholder="Tell us a bit about what you plan to sell and your experience..."
          value={note}
          onChange={e => setNote(e.target.value)}
          className="bg-[#111]/5 border-white/10 resize-none h-28 text-sm"
          data-testid="input-seller-note"
        />
      </div>
      <Button
        className="w-full h-11 font-bold"
        onClick={onSubmit}
        disabled={isPending}
        data-testid="btn-seller-apply"
      >
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}
