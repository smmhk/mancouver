import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export function SessionChat({
  sessionId,
  participants,
}: {
  sessionId: string;
  participants: { user_id: string; display_name: string }[];
}) {
  const qc = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of participants) m.set(p.user_id, p.display_name);
    return m;
  }, [participants]);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["session-messages", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_messages")
        .select("id, session_id, user_id, content, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`session-messages:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          qc.setQueryData<ChatMessage[]>(["session-messages", sessionId], (old) => {
            if (!old) return [msg];
            if (old.some((m) => m.id === msg.id)) return old;
            return [...old, msg];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "session_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const oldMsg = payload.old as { id: string };
          qc.setQueryData<ChatMessage[]>(["session-messages", sessionId], (old) =>
            old ? old.filter((m) => m.id !== oldMsg.id) : old,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  // Autoscroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("session_messages")
        .insert({ session_id: sessionId, user_id: currentUserId, content });
      if (error) throw error;
    },
    onSuccess: () => setText(""),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    send.mutate(trimmed);
  };

  return (
    <div className="rounded-xl bg-surface/60 border border-border/60 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Session Chat</p>
        <span className="text-[10px] text-muted-foreground">Only participants</span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-64 min-h-[80px] overflow-y-auto space-y-2 mb-3 pr-1"
      >
        {isLoading ? (
          <p className="text-xs text-muted-foreground italic">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No messages yet. Share your court number or meeting spot!
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === currentUserId;
            const name = nameMap.get(m.user_id) ?? "Player";
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-brand text-white" : "bg-background text-foreground border border-border/60"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                  <span className="font-semibold">{mine ? "You" : name}</span>
                  <span>·</span>
                  <span>{format(new Date(m.created_at), "MMM d, h:mm a")}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Message participants…"
          className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || send.isPending}
          className="rounded-xl bg-brand text-white hover:bg-brand-dark shrink-0"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
