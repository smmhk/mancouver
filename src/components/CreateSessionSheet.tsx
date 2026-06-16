import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Clock, MapPin, Search, Users } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CourtMap, type Court } from "@/components/CourtMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { fetchDailyForecast, isSevereWeather, wmoToDisplay, type DailyForecast } from "@/lib/weather";

const NTRP_OPTIONS = ["Any", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5"];

function generateSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function fmtSlot(s: string) {
  const [h, m] = s.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return format(d, "h:mma").toLowerCase();
}

function SectionHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="grid place-items-center size-5 rounded-full bg-brand text-white text-[10px] font-bold">
        {step}
      </span>
      <h3 className="text-sm font-bold tracking-tight">{title}</h3>
    </div>
  );
}

export function CreateSessionSheet({
  open,
  onOpenChange,
  defaultDate,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (b: boolean) => void;
  defaultDate?: Date;
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(defaultDate ?? new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [ntrp, setNtrp] = useState("Any");
  const [courtSearch, setCourtSearch] = useState("");

  useEffect(() => { if (defaultDate) setDate(defaultDate); }, [defaultDate]);

  const allSlots = useMemo(generateSlots, []);

  const { data: courts = [] } = useQuery({
    queryKey: ["courts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courts")
        .select("id, name, latitude, longitude, address")
        .order("name");
      if (error) throw error;
      return data as Court[];
    },
  });

  const selectedCourt = courts.find((c) => c.id === courtId) ?? null;

  const filteredCourts = useMemo(() => {
    const q = courtSearch.trim().toLowerCase();
    const sorted = [...courts].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q),
    );
  }, [courts, courtSearch]);

  // Weather for selected court + date
  const { data: forecast } = useQuery({
    queryKey: ["court-forecast", selectedCourt?.id],
    enabled: !!selectedCourt,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!selectedCourt) return [] as DailyForecast[];
      return fetchDailyForecast(selectedCourt.latitude, selectedCourt.longitude, 16);
    },
  });

  const dateKey = date ? format(date, "yyyy-MM-dd") : null;
  const dayForecast = forecast?.find((f) => f.date === dateKey) ?? null;
  const wDisplay = dayForecast ? wmoToDisplay(dayForecast.code) : null;
  const severe = dayForecast ? isSevereWeather(dayForecast.code, dayForecast.precipProbability) : false;

  const sortedSlots = useMemo(() => [...slots].sort(), [slots]);
  const summaryStart = sortedSlots[0] ?? null;
  const summaryEndSlot = sortedSlots[sortedSlots.length - 1] ?? null;
  const summaryEnd = useMemo(() => {
    if (!summaryEndSlot) return null;
    const [h, m] = summaryEndSlot.split(":").map(Number);
    const d = new Date(2000, 0, 1, h, m + 30);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, [summaryEndSlot]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (!date) throw new Error("Pick a date");
      if (!summaryStart || !summaryEnd) throw new Error("Pick at least one time slot");
      if (!courtId) throw new Error("Pick a court");

      const ntrpVal = ntrp === "Any" ? null : Number(ntrp);

      const { data, error } = await supabase.rpc("book_or_join_session", {
        _court_id: courtId,
        _session_date: format(date, "yyyy-MM-dd"),
        _start_time: summaryStart,
        _end_time: summaryEnd,
        _max_players: maxPlayers,
        _ntrp_min: ntrpVal,
        _ntrp_max: ntrpVal,
      });
      if (error) throw error;
      return data as { status: "created" | "joined" | "already_joined" | "full"; session_id: string };
    },
    onSuccess: (result) => {
      switch (result.status) {
        case "created":
          toast.success("New tennis session created successfully.");
          break;
        case "joined":
          toast.success("Existing session found. You have been added to the participant list.");
          break;
        case "already_joined":
          toast("You are already registered for this session.");
          break;
        case "full":
          toast.error("This session is full.");
          return;
      }
      qc.invalidateQueries({ queryKey: ["sessions"] });
      onOpenChange?.(false);
      setSlots([]);
      setCourtId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create"),
  });


  const canSubmit = !!date && !!courtId && slots.length > 0 && !create.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-surface border-border p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-4 sm:px-5 pt-4 pb-3 border-b border-border bg-card">
          <SheetTitle className="text-xl sm:text-2xl font-bold tracking-tight">Host a Game</SheetTitle>
          <p className="text-xs text-muted-foreground">Pick a date, time, and court — we'll handle the rest.</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4">
          {/* 1. Calendar */}
          <section className="bg-card rounded-2xl border border-border p-2 sm:p-3">
            <div className="px-2 pt-1 pb-2">
              <SectionHeader step={1} title="Select a date" />
            </div>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              className="pointer-events-auto w-full p-0 [&_table]:w-full [&_th]:w-[14.28%] [&_td]:w-[14.28%] [&_button]:w-full [&_button]:h-10 sm:[&_button]:h-11"
            />
            {date && (
              <div className="mt-2 mx-1 mb-1 rounded-xl bg-brand/5 border border-brand/15 px-3 py-2 flex items-center gap-2">
                <CalendarDays className="size-4 text-brand shrink-0" />
                <p className="text-sm font-semibold text-foreground truncate">
                  {format(date, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            )}
          </section>

          {/* 2. Time Selection */}
          <section className="bg-card rounded-2xl border border-border p-3 sm:p-4">
            <SectionHeader step={2} title="Choose time slots" />
            <p className="text-[11px] text-muted-foreground mb-2.5">30-minute increments. Pick consecutive slots.</p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
              {allSlots.map((s) => {
                const active = slots.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setSlots((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
                    }
                    className={cn(
                      "py-2 rounded-lg text-center text-xs font-semibold border transition-colors",
                      active
                        ? "bg-brand border-brand text-white shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-brand/40"
                    )}
                  >
                    {fmtSlot(s)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Court */}
          <section className="bg-card rounded-2xl border border-border p-3 sm:p-4 space-y-3">
            <SectionHeader step={3} title="Choose a court" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={courtSearch}
                onChange={(e) => setCourtSearch(e.target.value)}
                placeholder="Search courts by name or address"
                className="pl-9 bg-background border-border h-10"
              />
            </div>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-background divide-y divide-border">
              {filteredCourts.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No courts match "{courtSearch}"</p>
              ) : (
                filteredCourts.map((c) => {
                  const active = c.id === courtId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCourtId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm transition-colors",
                        active ? "bg-brand/10 text-brand font-semibold" : "hover:bg-cream",
                      )}
                    >
                      <div className="font-medium">{c.name}</div>
                      {c.address && (
                        <div className="text-[11px] text-muted-foreground">{c.address}</div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <CourtMap courts={filteredCourts} selectedId={courtId} onSelect={(c) => setCourtId(c.id)} height={200} />
          </section>

          {/* 4. Weather forecast */}
          {selectedCourt && (
            <section className="bg-card rounded-2xl border border-border p-3 sm:p-4">
              <SectionHeader step={4} title="Weather forecast" />
              {!dayForecast ? (
                <p className="text-xs text-muted-foreground">Loading forecast…</p>
              ) : (
                <div className="rounded-xl bg-surface/80 border border-border/60 p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl leading-none" aria-hidden>{wDisplay?.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{wDisplay?.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {dayForecast.tempMax != null ? `${Math.round(dayForecast.tempMax)}°C` : "—"}
                        {dayForecast.tempMin != null && (
                          <span className="text-muted-foreground/70"> / {Math.round(dayForecast.tempMin)}° low</span>
                        )}
                      </p>
                    </div>
                    {dayForecast.precipProbability != null && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rain</p>
                        <p className="text-sm font-bold text-brand">{dayForecast.precipProbability}%</p>
                      </div>
                    )}
                  </div>
                  {severe && (
                    <div className="mt-2.5 flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                      <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                      <div className="text-xs leading-snug">
                        <p className="font-bold">Weather Alert</p>
                        <p>Heavy rain or storms expected. Consider rescheduling.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 5. Players + NTRP */}
          <section className="bg-card rounded-2xl border border-border p-3 sm:p-4">
            <SectionHeader step={5} title="Players & level" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Max players</Label>
                <Select value={String(maxPlayers)} onValueChange={(v) => setMaxPlayers(Number(v))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 6, 8].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">NTRP level</Label>
                <Select value={ntrp} onValueChange={setNtrp}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NTRP_OPTIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* 6. Summary */}
          <section className="bg-gradient-to-br from-brand/5 to-brand/10 rounded-2xl border border-brand/20 p-3 sm:p-4">
            <SectionHeader step={6} title="Session summary" />
            <dl className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CalendarDays className="size-4 text-brand mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</dt>
                  <dd className="font-semibold truncate">{date ? format(date, "EEE, MMM d, yyyy") : "—"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="size-4 text-brand mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Time</dt>
                  <dd className="font-semibold">
                    {summaryStart && summaryEnd
                      ? `${fmtSlot(summaryStart)} – ${fmtSlot(summaryEnd)}`
                      : "—"}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="size-4 text-brand mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Court</dt>
                  <dd className="font-semibold truncate">{selectedCourt?.name ?? "—"}</dd>
                </div>
              </div>
              {dayForecast && wDisplay && (
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden>{wDisplay.icon}</span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Weather</dt>
                    <dd className="font-semibold">
                      {wDisplay.label}
                      {dayForecast.tempMax != null && ` • ${Math.round(dayForecast.tempMax)}°C`}
                      {dayForecast.precipProbability != null && ` • ${dayForecast.precipProbability}% rain`}
                    </dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Users className="size-4 text-brand mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Participants</dt>
                  <dd className="font-semibold">1 / {maxPlayers} (you'll auto-join)</dd>
                </div>
              </div>
            </dl>
          </section>
        </div>

        {/* Sticky action bar */}
        <div className="border-t border-border bg-card px-4 sm:px-5 py-3">
          <Button
            onClick={() => create.mutate()}
            disabled={!canSubmit}
            className="w-full h-12 bg-brand text-white hover:bg-brand-dark rounded-xl font-semibold tracking-tight text-base shadow-lg shadow-brand/20"
          >
            {create.isPending ? "Publishing..." : "Create Session"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
