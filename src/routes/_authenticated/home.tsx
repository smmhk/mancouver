import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Bell, CloudRain, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SessionCard, type SessionCardData, type SessionWeather } from "@/components/SessionCard";
import { MonthCalendar } from "@/components/MonthCalendar";
import { CreateSessionSheet } from "@/components/CreateSessionSheet";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { enablePushNotifications } from "@/lib/push";
import {
  fetchDailyForecast,
  VANCOUVER_COORDS,
  wmoToDisplay,
  type DailyForecast,
} from "@/lib/weather";
import { persistCourtForecast } from "@/lib/weather.functions";
import { filterAndSortSessions } from "@/lib/sessions";
import { useGuestMode, setGuestMode } from "@/lib/guest-mode";
import { GuestGateDialog } from "@/components/GuestGateDialog";
import { listPublicSessions } from "@/lib/public-sessions.functions";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Home — Baseline YVR" },
      { name: "description", content: "Join and host tennis sessions across Vancouver." },
    ],
  }),
});

type CourtRef = { id: string; latitude: number; longitude: number };

function HomePage() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefault, setCreateDefault] = useState<Date | undefined>(undefined);
  const persistForecast = useServerFn(persistCourtForecast);

  // Fetch profile (for avatar initials + notif prompt)
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, ntrp_rating, notifications_enabled, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Signed URL for avatar (private bucket)
  const { data: avatarUrl } = useQuery({
    queryKey: ["avatar", user?.id, profile?.avatar_url],
    enabled: !!user && !!profile?.avatar_url,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(profile!.avatar_url as string, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const [accountOpen, setAccountOpen] = useState(false);

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

  const { data: sessionsRaw = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const cutoffDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = format(cutoffDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id, creator_id, session_date, start_time, end_time, max_players, ntrp_min, ntrp_max, status,
          court:courts ( id, name, latitude, longitude ),
          participants:session_participants ( user_id ),
          guests:session_guests ( id, guest_name )
        ` as never)
        .gte("session_date", twoDaysAgo)
        .neq("status", "cancelled")
        .order("session_date")
        .order("start_time");
      if (error) throw error;

      const userIds = Array.from(
        new Set((data ?? []).flatMap((s: any) => (s.participants ?? []).map((p: any) => p.user_id))),
      );
      let profilesById: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("public_profiles" as any)
          .select("id, display_name")
          .in("id", userIds);
        if (pErr) throw pErr;
        profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name]));
      }

      return (data ?? []).map((s: any) => ({
        id: s.id as string,
        session_date: s.session_date as string,
        start_time: s.start_time as string,
        end_time: s.end_time as string,
        ntrp_min: s.ntrp_min as number | null,
        ntrp_max: s.ntrp_max as number | null,
        max_players: s.max_players as number,
        status: s.status as string | undefined,
        court: s.court ? { id: s.court.id, name: s.court.name, latitude: s.court.latitude, longitude: s.court.longitude } : null,
        participant_count: s.participants?.length ?? 0,
        joined: !!s.participants?.some((p: any) => p.user_id === user?.id),
        is_creator: s.creator_id === user?.id,
        participants: (s.participants ?? []).map((p: any) => ({
          user_id: p.user_id,
          display_name: profilesById[p.user_id] || "Unknown Player",
        })),
        guests: (s.guests ?? []).map((g: any) => ({ id: g.id as string, guest_name: g.guest_name as string })),
      }));
    },
  });

  // Vancouver-wide forecast → drives calendar weather
  const { data: vancouverForecast = [] } = useQuery({
    queryKey: ["weather", "vancouver"],
    queryFn: () => fetchDailyForecast(VANCOUVER_COORDS.lat, VANCOUVER_COORDS.lng, 16),
    staleTime: 30 * 60_000, // 30 min
    refetchInterval: 60 * 60_000, // 1 hr auto refresh
  });

  // Unique courts referenced by upcoming sessions
  const uniqueCourts: CourtRef[] = useMemo(() => {
    const seen = new Map<string, CourtRef>();
    for (const s of sessionsRaw) {
      if (s.court && !seen.has(s.court.id)) {
        seen.set(s.court.id, { id: s.court.id, latitude: s.court.latitude, longitude: s.court.longitude });
      }
    }
    return Array.from(seen.values());
  }, [sessionsRaw]);

  // Per-court forecasts (parallel queries)
  const courtForecastQueries = useQueries({
    queries: uniqueCourts.map((c) => ({
      queryKey: ["weather", "court", c.id],
      queryFn: () => fetchDailyForecast(c.latitude, c.longitude, 16),
      staleTime: 30 * 60_000,
      refetchInterval: 60 * 60_000,
    })),
  });

  const forecastByCourt: Record<string, DailyForecast[]> = useMemo(() => {
    const out: Record<string, DailyForecast[]> = {};
    uniqueCourts.forEach((c, i) => {
      const r = courtForecastQueries[i]?.data;
      if (r) out[c.id] = r;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueCourts, courtForecastQueries.map((q) => q.dataUpdatedAt).join(",")]);

  // Persist court forecasts in background (best-effort, for analytics + future notifications)
  useEffect(() => {
    if (!user) return;
    uniqueCourts.forEach((c) => {
      const key = `forecast-persisted-${c.id}`;
      const last = sessionStorage.getItem(key);
      if (last && Date.now() - Number(last) < 60 * 60_000) return;
      sessionStorage.setItem(key, String(Date.now()));
      persistForecast({ data: { courtId: c.id, lat: c.latitude, lng: c.longitude } }).catch(() => {});
    });
  }, [uniqueCourts, persistForecast, user]);

  // Tick every 30s so live status (NOW badge + past filtering) updates without manual refresh
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Attach per-session weather based on the session's court forecast for that date
  const sessions: SessionCardData[] = useMemo(() => {
    const mapped = sessionsRaw.map((s) => {
      let weather: SessionWeather | null = null;
      if (s.court) {
        const list = forecastByCourt[s.court.id];
        const match = list?.find((f) => f.date === s.session_date);
        if (match) {
          weather = {
            code: match.code,
            tempMax: match.tempMax,
            tempMin: match.tempMin,
            precipProbability: match.precipProbability,
          };
        }
      }
      return {
        id: s.id,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        ntrp_min: s.ntrp_min,
        ntrp_max: s.ntrp_max,
        max_players: s.max_players,
        court: s.court ? { name: s.court.name } : null,
        participant_count: s.participant_count,
        joined: s.joined,
        is_creator: s.is_creator,
        participants: s.participants,
        guests: s.guests,
        weather,
      };
    });
    return filterAndSortSessions(mapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsRaw, forecastByCourt, nowTick]);

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
      const { data, error } = await supabase.rpc("leave_session", { _session_id: sessionId });
      if (error) throw error;
      return data as { success: boolean; cancelled: boolean; remaining: number };
    },
    onSuccess: (data) => {
      if (data?.cancelled) {
        toast.success("Reservation cancelled. Session has no remaining participants and was cancelled.");
      } else {
        toast.success("Reservation cancelled.");
      }
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't leave"),
  });

  const sessionCountByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of sessions) out[s.session_date] = (out[s.session_date] ?? 0) + 1;
    return out;
  }, [sessions]);

  const weatherByDate = useMemo(() => {
    const out: Record<string, { code: number }> = {};
    for (const f of vancouverForecast) out[f.date] = { code: f.code };
    return out;
  }, [vancouverForecast]);

  const visibleSessions = useMemo(() => {
    if (!selectedDate) return sessions;
    const key = format(selectedDate, "yyyy-MM-dd");
    return sessions.filter((s) => s.session_date === key);
  }, [sessions, selectedDate]);

  const selectedForecast = useMemo(() => {
    if (!selectedDate) return null;
    const key = format(selectedDate, "yyyy-MM-dd");
    return vancouverForecast.find((f) => f.date === key) ?? null;
  }, [selectedDate, vancouverForecast]);

  const initials = (profile?.display_name ?? user?.email ?? "??")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-surface text-foreground pb-28 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 night-band court-lines px-5 md:px-8 py-4 flex justify-between items-center border-b border-white/10">
        <Link to="/home" className="block relative z-10">
          <h1 className="font-display text-2xl md:text-3xl tracking-wide text-white">
            Man<span className="text-ace">couver</span>
          </h1>
          <p className="text-[10px] text-white/70 uppercase tracking-[0.25em]">Find Your Next Rally</p>
        </Link>
        <div className="flex items-center gap-3 relative z-10">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold truncate max-w-[140px] text-white">{profile?.display_name ?? user?.email}</p>
            {profile?.ntrp_rating != null && (
              <p className="text-[10px] text-ace uppercase tracking-widest">NTRP {profile.ntrp_rating}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="size-10 rounded-full bg-white/10 border border-white/25 grid place-items-center overflow-hidden hover:ring-2 hover:ring-ace/60 transition"
            aria-label="Account settings"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your avatar" className="size-full object-cover" />
            ) : (
              <span className="text-ace font-bold text-xs">{initials}</span>
            )}
          </button>
          <button
            onClick={() => signOut()}
            className="size-9 grid place-items-center rounded-full text-white/70 hover:text-ace"
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
            sessionCountByDate={sessionCountByDate}
            weatherByDate={weatherByDate}
            selected={selectedDate}
            onSelect={(d) => setSelectedDate(selectedDate && d.getTime() === selectedDate.getTime() ? null : d)}
          />

          {/* Date Details panel */}
          {selectedDate && (
            <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{format(selectedDate, "EEEE, MMMM d")}</h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-surface/60 border border-border/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Weather Forecast
                  </p>
                  {selectedForecast ? (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-4xl" aria-hidden>{wmoToDisplay(selectedForecast.code).icon}</span>
                        <p className="text-base font-semibold">{wmoToDisplay(selectedForecast.code).label}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground uppercase tracking-widest text-[9px]">High</p>
                          <p className="font-bold">{selectedForecast.tempMax != null ? `${Math.round(selectedForecast.tempMax)}°C` : "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground uppercase tracking-widest text-[9px]">Low</p>
                          <p className="font-bold">{selectedForecast.tempMin != null ? `${Math.round(selectedForecast.tempMin)}°C` : "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground uppercase tracking-widest text-[9px]">Rain</p>
                          <p className="font-bold text-brand">{selectedForecast.precipProbability ?? 0}%</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Forecast unavailable for this date.</p>
                  )}
                </div>
                <div className="rounded-xl bg-surface/60 border border-border/60 p-4 flex flex-col justify-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Scheduled Sessions
                  </p>
                  <p className="text-3xl font-bold text-brand">🎾 {visibleSessions.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {visibleSessions.length === 0 ? "No sessions yet — host one!" : "View details below."}
                  </p>
                </div>
              </div>
            </div>
          )}

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
                  className="bg-brand text-white hover:bg-brand-dark font-bold rounded-xl"
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
              className="w-full h-14 bg-brand text-white hover:bg-brand-dark rounded-2xl font-semibold tracking-tight text-base shadow-xl shadow-brand/10"
            >
              <Plus className="size-5 mr-1" /> Host a Game
            </Button>

            {/* Weather hint */}
            <div className="p-5 bg-brand/5 rounded-3xl border border-brand/10">
              <div className="flex items-center gap-2 mb-1">
                <CloudRain className="size-4 text-brand" />
                <h4 className="text-brand font-bold text-sm">Weather-Aware</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Calendar shows Vancouver's forecast at a glance. Each session card includes court-specific
                weather and a warning when heavy rain is expected.
              </p>
            </div>

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
          <div className="size-14 bg-brand rounded-full shadow-2xl shadow-brand/40 flex items-center justify-center text-white font-bold text-2xl">
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
      {user && (
        <AccountSettingsDialog
          open={accountOpen}
          onOpenChange={setAccountOpen}
          user={user}
          profile={profile}
          avatarPreviewUrl={avatarUrl ?? null}
        />
      )}
    </div>
  );
}
