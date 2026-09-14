import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  ChevronDown,
  Loader2,
  Package,
  Plus,
  Send,
  ShieldCheck,
  TicketCheck,
  UserRound,
} from "lucide-react";

type Ticket = {
  id: number;
  orderId: string;
  subject: string;
  description: string;
  imageUrl: string;
  status: "open" | "refunded" | "replaced" | "resolved";
  adminMessage: string | null;
  createdAt: string;
};

type SupportOrder = {
  id: number;
  orderId: string;
  total?: number;
  items?: Array<{ name?: string; productName?: string }>;
};

type View = "list" | "create" | "detail";

function statusLabel(status: Ticket["status"]) {
  return {
    open: "Open",
    refunded: "Refunded",
    replaced: "Replaced",
    resolved: "Resolved",
  }[status] ?? status;
}

function StatusBadge({ status }: { status: Ticket["status"] }) {
  const classes = {
    open: "bg-red-500/15 text-red-400 border-red-500/25",
    refunded: "bg-red-500/15 text-red-400 border-red-500/25",
    replaced: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    resolved: "bg-white/8 text-white/55 border-white/10",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes[status] ?? classes.resolved}`}>
      {statusLabel(status)}
    </span>
  );
}

function SelectField({
  label,
  required = false,
  value,
  onChange,
  children,
  disabled = false,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-white">
        {label}{required && <span className="text-white/75"> *</span>}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="appearance-none w-full h-11 rounded-xl border border-white/15 bg-[#202020] px-4 pr-10 text-sm text-white outline-none focus:border-white/40 transition-colors disabled:text-white/35 disabled:cursor-not-allowed"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/45" />
      </span>
    </label>
  );
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{title}</h1>
      <p className="text-base text-white/50">{description}</p>
    </div>
  );
}

function Footer() {
  return (
    <div className="border-t border-white/8 py-6 px-4 text-center space-y-2 mt-10">
      <div className="flex items-center justify-center gap-5 text-xs font-semibold text-white/50 tracking-widest uppercase">
        <span>Reviews</span>
        <a
          href="https://t.me/+3-lMkt-idutkOTIx"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-5 w-5 rounded-full bg-primary"
        >
          <Send className="h-2.5 w-2.5 text-white fill-white" />
        </a>
        <span>TOS</span>
        <span>FAQs</span>
      </div>
      <p className="text-xs text-white/25">© 2026 TurtleCC. All rights reserved</p>
    </div>
  );
}

export default function SupportPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("list");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ticketType, setTicketType] = useState("Card Order");
  const [orderId, setOrderId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const { data: tickets, isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/support"],
    staleTime: 30000,
  });

  const { data: orders } = useQuery<SupportOrder[]>({
    queryKey: ["/api/orders"],
    staleTime: 30000,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!orderId.trim()) throw new Error("Please select an order");
      if (!subject.trim()) throw new Error("Please enter a subject");
      if (!description.trim()) throw new Error("Please describe the issue");

      const res = await apiRequest("POST", "/api/support", {
        orderId: orderId.trim(),
        subject: subject.trim(),
        description: description.trim(),
        imageUrl: "",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support"] });
      toast({ title: "Ticket created", description: "Our team will review it shortly." });
      setTicketType("Card Order");
      setOrderId("");
      setSubject("");
      setDescription("");
      setView("list");
    },
    onError: (error: any) => toast({ title: "Unable to create ticket", description: error.message, variant: "destructive" }),
  });

  const filteredTickets = useMemo(
    () => (tickets ?? []).filter(ticket => statusFilter === "all" || ticket.status === statusFilter),
    [tickets, statusFilter],
  );

  const selectedOrder = orders?.find(order => order.orderId === selectedTicket?.orderId);

  function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    setView("detail");
  }

  function resetToList() {
    setSelectedTicket(null);
    setView("list");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="ticket-ui flex-1 max-w-2xl mx-auto w-full px-4 py-7 sm:py-10">
        {view === "list" && (
          <div className="space-y-6">
            <PageHeading title="My Support Tickets" description="View and track all your support tickets" />

            <button
              onClick={() => setView("create")}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-base transition-colors flex items-center justify-center gap-3"
              data-testid="button-create-ticket"
            >
              <Plus className="h-5 w-5" />
              Create Ticket
            </button>

            <section className="rounded-2xl border border-white/10 bg-[#181818] p-5 sm:p-7 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Tickets</h2>
                <p className="text-base text-white/50">
                  {tickets?.length ?? 0} {(tickets?.length ?? 0) === 1 ? "ticket" : "tickets"} total
                </p>
              </div>

              <SelectField
                label=""
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All Status"
              >
                <option value="open">Open</option>
                <option value="refunded">Refunded</option>
                <option value="replaced">Replaced</option>
                <option value="resolved">Resolved</option>
              </SelectField>

              {ticketsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <TicketCheck className="h-10 w-10 text-white/15 mx-auto" />
                  <p className="text-sm text-white/40">You don't have any tickets yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[480px]">
                    <div className="grid grid-cols-[1.2fr_0.8fr_1.2fr] gap-4 border-b border-white/15 px-3 pb-3 text-sm font-medium text-white/80">
                      <span>Subject</span>
                      <span>Type</span>
                      <span>Purchase</span>
                    </div>
                    <div className="divide-y divide-white/10">
                      {filteredTickets.map(ticket => (
                        <button
                          key={ticket.id}
                          onClick={() => openTicket(ticket)}
                          className="grid grid-cols-[1.2fr_0.8fr_1.2fr] gap-4 items-center w-full px-3 py-4 text-left hover:bg-white/[0.03] transition-colors"
                          data-testid={`ticket-row-${ticket.id}`}
                        >
                          <span className="font-medium text-white truncate">{ticket.subject}</span>
                          <span className="inline-flex w-fit rounded-full border border-white/15 px-3 py-1 text-xs text-white/85">Order</span>
                          <span className="flex items-center gap-2 min-w-0 text-sm text-white/75 truncate">
                            <Package className="h-4 w-4 shrink-0 text-white/50" />
                            {ticket.orderId}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {view === "create" && (
          <div className="space-y-6">
            <PageHeading title="Create Support Ticket" description="Create a new support ticket for your order" />

            <div className="flex items-start gap-4">
              <button
                onClick={resetToList}
                className="mt-1 p-1 text-white/80 hover:text-white transition-colors"
                aria-label="Back to tickets"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h2 className="text-3xl font-bold text-white">Create Support Ticket</h2>
                <p className="mt-2 text-base leading-relaxed text-white/55">
                  Need help with an order or log purchase? Create a support ticket and we'll assist you.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-primary bg-primary/[0.04] px-5 py-5 flex items-start gap-4">
              <AlertCircle className="h-6 w-6 shrink-0 text-primary mt-0.5" />
              <p className="text-base leading-relaxed text-primary">
                <strong>Important:</strong> You can only create 5 tickets in 24 hours. If you abuse this system, you will be banned immediately.
              </p>
            </div>

            <section className="rounded-2xl border border-white/10 bg-[#181818] p-5 sm:p-7 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Ticket Information</h2>
                <p className="mt-1 text-base leading-relaxed text-white/50">
                  Provide details about the issue you're experiencing with your purchase.
                </p>
              </div>

              <SelectField
                label="Ticket Type"
                required
                value={ticketType}
                onChange={setTicketType}
              >
                <option value="Card Order">Card Order</option>
                <option value="Log Purchase">Log Purchase</option>
                <option value="Payment">Payment</option>
                <option value="Other">Other</option>
              </SelectField>

              <SelectField
                label="Select Order"
                required
                value={orderId}
                onChange={setOrderId}
                placeholder="Select an order"
                disabled={!orders?.length}
              >
                {(orders ?? []).map(order => (
                  <option key={order.orderId} value={order.orderId}>{order.orderId}</option>
                ))}
              </SelectField>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-white">Subject <span className="text-white/75">*</span></span>
                <input
                  value={subject}
                  maxLength={200}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g., Card not working"
                  className="w-full h-11 rounded-xl border border-white/15 bg-[#202020] px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40 transition-colors"
                  data-testid="input-ticket-subject"
                />
                <span className="block text-xs text-white/50">{subject.length}/200 characters</span>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-white">Message <span className="text-white/75">*</span></span>
                <textarea
                  value={description}
                  maxLength={2000}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the issue you're experiencing in detail..."
                  rows={4}
                  className="w-full rounded-xl border border-white/15 bg-[#202020] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40 transition-colors resize-none"
                  data-testid="input-ticket-message"
                />
                <span className="block text-sm leading-relaxed text-white/50">
                  Provide as much detail as possible to help us assist you quickly.
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={resetToList}
                  className="h-12 rounded-xl border border-white/20 bg-white/[0.02] text-white font-semibold hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="h-12 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-black font-semibold transition-colors flex items-center justify-center gap-2"
                  data-testid="button-submit-ticket"
                >
                  {submitMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create Ticket"}
                </button>
              </div>
            </section>
          </div>
        )}

        {view === "detail" && selectedTicket && (
          <div className="space-y-6">
            <PageHeading title="Ticket Details" description="View ticket details" />

            <div className="flex items-start gap-4">
              <button
                onClick={resetToList}
                className="mt-1 p-1 text-white/80 hover:text-white transition-colors"
                aria-label="Back to tickets"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div className="min-w-0">
                <h2 className="text-3xl font-bold text-white break-words">{selectedTicket.subject}</h2>
                <div className="mt-2 flex items-center gap-3">
                  <StatusBadge status={selectedTicket.status} />
                  <span className="text-sm text-white/60">#{selectedTicket.id}</span>
                </div>
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#181818]">
              <div className="px-5 py-6 sm:px-7 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white">Conversation</h2>
                <p className="text-base text-white/50">
                  {selectedTicket.adminMessage ? "3 messages" : "2 messages"}
                </p>
              </div>

              <div className="space-y-7 px-5 py-7 sm:px-7">
                <div className="flex justify-center">
                  <span className="rounded-full bg-white/[0.08] px-4 py-2 text-sm text-white/55">
                    {new Date(selectedTicket.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm text-white/55">
                      <strong className="text-white">You</strong>
                      <span className="ml-2">{new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </p>
                    <div className="rounded-2xl rounded-tl-md bg-blue-500 px-5 py-3 text-base leading-relaxed text-white">
                      {selectedTicket.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-start justify-end gap-3">
                  <div className="min-w-0 max-w-[85%] space-y-2 text-right">
                    <p className="text-sm text-white/55">
                      <span className="mr-2">{new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <strong className="text-white">System</strong>
                    </p>
                    <div className="rounded-2xl rounded-tr-md border border-white/10 bg-[#242424] px-5 py-3 text-left text-base leading-relaxed text-white/60">
                      This is an automated reply. You will receive an actual reply within 12 hours or so.
                    </div>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#242424] text-white/60">
                    <Bot className="h-6 w-6" />
                  </div>
                </div>

                {selectedTicket.adminMessage && (
                  <div className="flex items-start justify-end gap-3">
                    <div className="min-w-0 max-w-[85%] space-y-2 text-right">
                      <p className="text-sm text-white/55">
                        <span className="mr-2">Admin</span>
                        <strong className="text-white">Reply</strong>
                      </p>
                      <div className="rounded-2xl rounded-tr-md bg-[#292929] px-5 py-3 text-left text-base leading-relaxed text-white">
                        {selectedTicket.adminMessage}
                      </div>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#181818] p-5 sm:p-7 space-y-5">
              <h2 className="text-2xl font-bold text-white">Order Information</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-white">Order ID</p>
                  <p className="mt-2 flex items-center gap-2 text-base text-white/55">
                    <Package className="h-5 w-5 text-white/55" />
                    {selectedTicket.orderId}
                  </p>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-sm font-medium text-white">Total Amount</p>
                  <p className="mt-2 text-base text-white/55">
                    {typeof selectedOrder?.total === "number" ? `$${(selectedOrder.total / 100).toFixed(2)}` : "—"}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}