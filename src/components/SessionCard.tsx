import { format } from "date-fns";
import { AlertTriangle, Calendar, CalendarPlus, Cloud, Clock, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { wmoToDisplay, isSevereWeather } from "@/lib/weather";
import { getSessionLiveStatus } from "@/lib/sessions";
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  downloadICS,
  type CalendarEventInput,
} from "@/lib/calendar";
import { SessionChat } from "@/components/SessionChat";

export interface SessionParticipant {
  user_id: string;
  display_name: string;
}

export interface SessionWeather {
  code: number;
  tempMax: number | null;
  tempMin: number | null;
  precipProbability: number | null;
}

export interface SessionCardData {
  id: string;
  session_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  ntrp_min: number | null;
  ntrp_max: number | null;
  max_players: number;
  court: { name: string } | null;
  participant_count: number;
  joined: boolean;
  is_creator: boolean;
  participants: SessionParticipant[];
  weather: SessionWeather | null;
}

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

function ntrpLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return "All Levels";
  if (min != null && max != null) return `NTRP ${min} – ${max}`;
  return `NTRP ${min ?? max}+`;
}

export function SessionCard({
  s,
  onJoin,
  onLeave,
  busy,
}: {
  s: SessionCardData;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  busy: boolean;
}) {
  const full = s.participant_count >= s.max_players;
  const isLive = getSessionLiveStatus(s) === "active";
  const w = s.weather;
  const wDisplay = w ? wmoToDisplay(w.code) : null;
  const severe = w ? isSevereWeather(w.code, w.precipProbability) : false;

  return (
    <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border shadow-sm">
      {/* Header: court + level */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <MapPin className="size-3.5" />
            <span className="uppercase tracking-wide truncate">{s.court?.name ?? "Court TBA"}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold leading-tight text-foreground">
            {s.court?.name ?? "Tennis Session"}
          </h3>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {isLive && (
            <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 animate-pulse">
              <span className="size-1.5 rounded-full bg-white" /> NOW
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-brand/10 text-brand text-[10px] font-bold uppercase tracking-wider">
            {ntrpLabel(s.ntrp_min, s.ntrp_max)}
          </span>
          {s.joined && <AddToCalendarMenu s={s} />}
        </div>
      </div>

      {/* Date + time */}
      <div className="space-y-1.5 text-sm text-foreground/80 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-brand" />
          <span>{formatDateLong(s.session_date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-brand" />
          <span>
            {formatTime(s.start_time)} – {formatTime(s.end_time)}
          </span>
        </div>
      </div>

      {/* Weather */}
      {wDisplay && w && (
        <div className="rounded-xl bg-surface/60 border border-border/60 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Cloud className="size-3.5" /> Weather
          </div>
          <div className="flex items-center gap-4">
            <span className="text-3xl leading-none" aria-hidden>
              {wDisplay.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{wDisplay.label}</p>
              <p className="text-xs text-muted-foreground">
                {w.tempMax != null ? `${Math.round(w.tempMax)}°C` : "—"}
                {w.tempMin != null && (
                  <span className="text-muted-foreground/70"> / {Math.round(w.tempMin)}°C low</span>
                )}
              </p>
            </div>
            {w.precipProbability != null && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rain</p>
                <p className="text-sm font-bold text-brand">{w.precipProbability}%</p>
              </div>
            )}
          </div>
          {severe && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <div className="text-xs leading-snug">
                <p className="font-bold">Weather Alert</p>
                <p>Heavy rain or storms are expected during this session. It may be affected by weather conditions.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Participants */}
      <div className="rounded-xl bg-surface/60 border border-border/60 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-brand" />
            <span>Participants: {s.participant_count}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {s.participant_count} / {s.max_players}
          </span>
        </div>
        {s.participants.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No players joined yet.</p>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Players</p>
            <ul className="flex flex-wrap gap-1.5">
              {s.participants.map((p) => (
                <li key={p.user_id} className="px-2.5 py-1 rounded-full bg-brand/10 text-brand text-xs font-medium">
                  {p.display_name}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Action */}
      <div className="flex items-center justify-between gap-3">
        {s.is_creator ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand">Your session</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">{full && !s.joined ? "This session is full." : ""}</span>
        )}

        {s.joined ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={busy}
                className="rounded-xl border-border bg-transparent hover:bg-background"
              >
                Cancel Reservation
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel your reservation?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel your reservation for this session? Sessions remain active as long as
                  at least one participant is registered. Empty sessions are automatically cancelled.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Reservation</AlertDialogCancel>
                <AlertDialogAction onClick={() => onLeave(s.id)}>Yes, Cancel Reservation</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            disabled={busy || full}
            onClick={() => onJoin(s.id)}
            className="px-6 rounded-xl bg-brand text-white hover:bg-brand-dark font-bold shadow-lg shadow-brand/10"
          >
            {full ? "Full" : "I'm Down"}
          </Button>
        )}
      </div>
    </div>
  );
}

function AddToCalendarMenu({ s }: { s: SessionCardData }) {
  const title = `Tennis Session${s.court?.name ? ` – ${s.court.name}` : ""}`;
  const location = s.court?.name ?? "Vancouver, BC";
  const description = `Tennis session with ${s.participant_count}/${s.max_players} players.\nLevel: ${ntrpLabel(
    s.ntrp_min,
    s.ntrp_max,
  )}\nView session: ${typeof window !== "undefined" ? window.location.origin : ""}/home`;

  const baseEvent = (reminderMinutes: number): CalendarEventInput => ({
    id: s.id,
    title,
    location,
    description,
    date: s.session_date,
    startTime: s.start_time,
    endTime: s.end_time,
    reminderMinutes,
    url: typeof window !== "undefined" ? `${window.location.origin}/home` : undefined,
  });

  const open = (kind: "apple" | "google" | "outlook", reminderMinutes = 60) => {
    const ev = baseEvent(reminderMinutes);
    if (kind === "apple") downloadICS(ev);
    else if (kind === "google") window.open(buildGoogleCalendarUrl(ev), "_blank", "noopener,noreferrer");
    else window.open(buildOutlookCalendarUrl(ev), "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Add to Calendar"
          title="Add to Calendar"
          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors"
        >
          <CalendarPlus className="size-3.5" />
          <span>Add to Calendar</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Add to Calendar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => open("apple")}>Apple Calendar (.ics)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open("google")}>Google Calendar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open("outlook")}>Outlook Calendar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Reminder (Apple .ics)
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => open("apple", 30)}>30 minutes before</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open("apple", 60)}>1 hour before (default)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open("apple", 60 * 24)}>24 hours before</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
