import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SessionCard, type SessionCardData } from "@/components/SessionCard";
import { MonthCalendar } from "@/components/MonthCalendar";
import { CreateSessionSheet } from "@/components/CreateSessionSheet";
import { enablePushNotifications } from "@/lib/push";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Home — Baseline YVR" },
      { name: "description", content: "Join and host tennis sessions across Vancouver." },
    ],
  }),
});

function HomePage() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefault, setCreateDefault] = useState<Date | undefined>(undefined);

  // Fetch profile (for avatar initials + notif prompt)
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, ntrp_rating, notifications_enabled")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Prompt push notifications once after signup if not yet enabled
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.notifications_enabled) return;
    if (typeof window === "undefined") return;
    const key = `push-prompted-${user.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    const t = setTimeout(() => {
      toast("Get notified about your sessions?", {
        description: "Reminders, weather alerts, and cancellations.",
        action: { label: "Enable", onClick: () => enablePushNotifications(user.id) },
        duration: 8000,
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [user, profile]);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id, creator_id, session_date, start_time, end_time, max_players, ntrp_min, ntrp_max,
          court:courts ( name ),
          participants:session_participants ( user_id )
        `)
        .gte("session_date", today)
        .order("session_date")
        .order("start_time");
      if (error) throw error;
      return (data ?? []).map((s: any): SessionCardData => ({
        id: s.id,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        ntrp_min: s.ntrp_min,
        ntrp_max: s.ntrp_max,
        max_players: s.max_players,
        court: s.court,
        participant_count: s.participants?.length ?? 0,
        joined: !!s.participants?.some((p: any) => p.user_id === user?.id),
        is_creator: s.creator_id === user?.id,
      }));
    },
  });

  const join = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("session_participants")
        .insert({ session_id: sessionId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You're in. See you on court!");
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't join"),
  });

  const leave = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("session_participants")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't leave"),
  });

  const sessionDates = useMemo(() => new Set(sessions.map((s) => s.session_date)), [sessions]);

  const visibleSessions = useMemo(() => {
    if (!selectedDate) return sessions;
    const key = format(selectedDate, "yyyy-MM-dd");
    return sessions.filter((s) => s.session_date === key);
  }, [sessions, selectedDate]);

  const initials = (profile?.display_name ?? user?.email ?? "??")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-surface text-foreground pb-28 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 px-5 md:px-8 py-4 flex justify-between items-center border-b border-border bg-surface/80 backdrop-blur-md">
        <Link to="/home" className="block">
          <h1 className="text-xl font-extrabold italic uppercase tracking-tighter">
            Mancouver
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Find Your Next Rally</p>
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold truncate max-w-[140px]">{profile?.display_name ?? user?.email}</p>
            {profile?.ntrp_rating != null && (
              <p className="text-[10px] text-brand uppercase">NTRP {profile.ntrp_rating}</p>
            )}
          </div>
          <div className="size-10 rounded-full bg-brand/10 border border-brand/20 grid place-items-center">
            <span className="text-brand font-bold text-xs">{initials}</span>
          </div>
          <button
            onClick={() => signOut()}
            className="size-9 grid place-items-center rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* LEFT: Sessions + Calendar */}
        <section className="flex-1 p-4 md:p-8 space-y-8">
          {/* Calendar */}
          <MonthCalendar
            month={month}
            setMonth={setMonth}
            sessionDates={sessionDates}
            selected={selectedDate}
            onSelect={(d) => setSelectedDate(selectedDate && d.getTime() === selectedDate.getTime() ? null : d)}
          />

          {/* Upcoming */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <h2 className="text-2xl font-bold tracking-tight">
                {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Upcoming Games"}
              </h2>
              <span className="text-xs text-brand">
                {visibleSessions.length} {visibleSessions.length === 1 ? "game" : "games"}
              </span>
            </div>

            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                ← Show all upcoming
              </button>
            )}

            {isLoading ? (
              <div className="bg-card rounded-2xl p-8 border border-border text-center text-sm text-muted-foreground">
                Loading sessions…
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 border border-border text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedDate ? "No sessions on this day yet." : "No upcoming games. Be the first to host!"}
                </p>
                <Button
                  onClick={() => {
                    setCreateDefault(selectedDate ?? new Date());
                    setCreateOpen(true);
                  }}
                  className="bg-brand text-black hover:bg-brand-dark font-bold rounded-xl"
                >
                  <Plus className="size-4 mr-1" /> Host a Game
                </Button>
              </div>
            ) : (
              visibleSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  s={s}
                  onJoin={(id) => join.mutate(id)}
                  onLeave={(id) => leave.mutate(id)}
                  busy={join.isPending || leave.isPending}
                />
              ))
            )}
          </div>
        </section>

        {/* RIGHT: Create */}
        <aside className="w-full md:w-[400px] p-4 md:p-8 md:border-l border-border bg-surface/50 hidden md:block">
          <div className="space-y-6 sticky top-24">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Quick Create</h2>
              <p className="text-xs text-muted-foreground mt-1">Pick a date, time slots, and a court.</p>
            </div>

            <Button
              onClick={() => { setCreateDefault(selectedDate ?? new Date()); setCreateOpen(true); }}
              className="w-full h-14 bg-brand text-black hover:bg-brand-dark rounded-2xl font-extrabold uppercase tracking-tighter italic text-base shadow-xl shadow-brand/10"
            >
              <Plus className="size-5 mr-1" /> Host a Game
            </Button>

            {/* Notification card */}
            {!profile?.notifications_enabled && user && (
              <div className="p-6 bg-brand/5 rounded-3xl border border-brand/10">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="size-4 text-brand" />
                  <h4 className="text-brand font-bold text-sm">Stay in the loop</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Get push alerts when a spot opens up or the weather changes.
                </p>
                <button
                  onClick={() => enablePushNotifications(user.id).then((ok) => {
                    if (ok) qc.invalidateQueries({ queryKey: ["profile", user.id] });
                  })}
                  className="mt-4 text-[10px] font-bold uppercase tracking-widest text-brand border-b border-brand/30 pb-0.5"
                >
                  Enable Notifications
                </button>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Mobile FAB nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-around items-center z-40">
        <div className="flex flex-col items-center gap-1">
          <div className="size-1.5 rounded-full bg-brand mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
        </div>
        <button
          onClick={() => { setCreateDefault(selectedDate ?? new Date()); setCreateOpen(true); }}
          className="flex flex-col items-center -translate-y-5"
          aria-label="Host a game"
        >
          <div className="size-14 bg-brand rounded-full shadow-2xl shadow-brand/40 flex items-center justify-center text-black font-bold text-2xl">
            <Plus className="size-7" strokeWidth={3} />
          </div>
        </button>
        <button
          onClick={() => signOut()}
          className="flex flex-col items-center gap-1 opacity-60"
        >
          <LogOut className="size-4 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Sign out</span>
        </button>
      </nav>

      <CreateSessionSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={createDefault}
      />
    </div>
  );
}
