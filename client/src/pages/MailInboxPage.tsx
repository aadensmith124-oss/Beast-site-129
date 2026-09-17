import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft, Inbox } from "lucide-react";
import { useVerification } from "@/hooks/use-verification";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/date-utils";

export function MailInboxPage() {
  const { user, isLoading: isUserLoading } = useAuth();
  const { isApproved } = useVerification(!!user && !isUserLoading);
  const [selectedMail, setSelectedMail] = useState<any>(null);

  const { data: mails, isLoading } = useQuery<any[]>({
    queryKey: ["/api/mails"],
    enabled: isApproved,
    refetchInterval: 30000,
  });

  const readMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/mails/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mails"] });
    },
  });

  const openMail = (mail: any) => {
    setSelectedMail(mail);
    if (!mail.isRead) {
      readMutation.mutate(mail.id);
    }
  };

  if (!isApproved) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <Mail className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">You need to be a verified seller to access your mailbox.</p>
      </div>
    );
  }

  if (selectedMail) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Button variant="outline" size="sm" onClick={() => setSelectedMail(null)} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Inbox
        </Button>
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-lg font-bold text-foreground">{selectedMail.title}</CardTitle>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-1">
                {formatDate(selectedMail.createdAt, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground">
              {selectedMail.recipientId ? "Personal Message" : "Broadcast to All Sellers"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{selectedMail.body}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl">Mailbox</h1>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (!mails || mails.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <Inbox className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-sm">No messages yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {mails?.map((mail: any) => (
          <button
            key={mail.id}
            onClick={() => openMail(mail)}
            className="w-full text-left"
            data-testid={`mail-item-${mail.id}`}
          >
            <Card className={`border transition-colors hover:border-primary/30 cursor-pointer ${!mail.isRead ? "bg-card border-primary/20" : "bg-card/50 border-border"}`}>
              <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {!mail.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                  {mail.isRead && (
                    <span className="w-2 h-2 rounded-full bg-transparent flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${!mail.isRead ? "font-bold text-white" : "font-medium text-white/70"}`}>
                      {mail.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {mail.recipientId ? "Personal" : "All Sellers"}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(mail.createdAt, { month: "short", day: "numeric" })}
                  </span>
                  {!mail.isRead && (
                    <Badge className="ml-2 text-[9px] bg-primary/20 text-primary border-primary/30 px-1.5 py-0">NEW</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
