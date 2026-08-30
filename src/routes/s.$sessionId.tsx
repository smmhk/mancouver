import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/s/$sessionId")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: "Join this tennis session — Mancouver" },
      { name: "description", content: "You've been invited to a tennis session on Mancouver. Tap to view and join." },
      { property: "og:title", content: "Join this tennis session on Mancouver" },
      { property: "og:description", content: "Tap to view the session details and lock in your spot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
      { name: "session-id", content: params.sessionId },
    ],
  }),
  component: SharedSessionPage,
});

type SharedSession = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_players: number;
  ntrp_min: number | null;
  ntrp_max: number | null;
  status: string;
  court: { name: string | null; address: string | null } | null;
  participant_count: number;
  already_joined: boolean;
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, "h:mm a");
}

function formatDateLong(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEEE, MMMM d, yyyy");
}

function SharedSessionPage() {
  const { sessionId } = Route.useParams();
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const q = useQuery({
    enabled: !!session,
    queryKey: ["shared-session", sessionId],
    queryFn: async (): Promise<SharedSession | null> => {
      const { data, error } = await supabase
        .from("sessions")
        .select(
          "id, session_date, start_time, end_time, max_players, ntrp_min, ntrp_max, status, courts(name, address), session_participants(user_id)",
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const uid = session?.user.id;
      const parts = (data.session_participants ?? []) as { user_id: string }[];
      return {
        id: data.id,
        session_date: data.session_date,
        start_time: data.start_time,
        end_time: data.end_time,
        max_players: data.max_players,
        ntrp_min: data.ntrp_min,
        ntrp_max: data.ntrp_max,
        status: data.status,
        court: data.courts as { name: string | null; address: string | null } | null,
        participant_count: parts.length,
        already_joined: !!uid && parts.some((p) => p.user_id === uid),
      };
    },
  });

  const join = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase
        .from("session_participants")
        .insert({ session_id: sessionId, user_id: session.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You're in! See you on the court");
      navigate({ to: "/home", replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not join session"),
  });

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-surface">
        <div className="size-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" search={{ next: `/s/${sessionId}`, mode: undefined }} replace />;
  }

  if (q.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-surface">
        <div className="size-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  const s = q.data;

  if (!s) {
    return (
      <main className="min-h-screen grid place-items-center bg-surface p-6">
        <div className="max-w-md bg-card border border-border rounded-2xl p-6 text-center">
          <h1 className="font-display text-xl mb-2">Session unavailable</h1>
          <p className="text-sm text-muted-foreground mb-4">
            This session may have been cancelled or the link is invalid.
          </p>
          <Button onClick={() => navigate({ to: "/home" })} className="bg-brand text-white hover:bg-brand-dark rounded-xl">
            Browse sessions
          </Button>
        </div>
      </main>
    );
  }

  const full = s.participant_count >= s.max_players;
  const cancelled = s.status !== "scheduled";

  return (
    <main className="min-h-screen bg-surface p-4 sm:p-8 flex items-start justify-center">
      <div className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand mb-2">
          You've been invited
        </p>
        <h1 className="font-display text-2xl sm:text-3xl text-foreground mb-4">
          {s.court?.name ?? "Tennis Session"}
        </h1>

        <div className="space-y-2 text-sm text-foreground/80 mb-5">
          {s.court?.address && (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-brand" />
              <span>{s.court.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-brand" />
            <span>{formatDateLong(s.session_date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-brand" />
            <span>{formatTime(s.start_time)} – {formatTime(s.end_time)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-brand" />
            <span>{s.participant_count} / {s.max_players} players</span>
          </div>
        </div>

        {cancelled ? (
          <p className="text-sm text-destructive mb-4">This session has been cancelled.</p>
        ) : null}

        <div className="flex flex-col gap-2">
          {s.already_joined ? (
            <>
              <p className="text-sm text-brand font-semibold">You're already in this session.</p>
              <Button onClick={() => navigate({ to: "/home" })} className="bg-brand text-white hover:bg-brand-dark rounded-xl h-11 font-bold uppercase tracking-wider">
                Open in Mancouver
              </Button>
            </>
          ) : (
            <Button
              disabled={join.isPending || full || cancelled}
              onClick={() => join.mutate()}
              className="bg-brand text-white hover:bg-brand-dark rounded-xl h-11 font-bold uppercase tracking-wider"
            >
              {cancelled ? "Cancelled" : full ? "Session full" : join.isPending ? "Joining…" : "I'm Down — Join Session"}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate({ to: "/home" })} className="rounded-xl h-11">
            View all sessions
          </Button>
        </div>
      </div>
    </main>
  );
}

