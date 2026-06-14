import { format } from "date-fns";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
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

export interface SessionParticipant {
  user_id: string;
  display_name: string;
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
        <span className="shrink-0 px-2 py-0.5 rounded bg-brand/10 text-brand text-[10px] font-bold uppercase tracking-wider">
          {ntrpLabel(s.ntrp_min, s.ntrp_max)}
        </span>
      </div>

      {/* Date + time */}
      <div className="space-y-1.5 text-sm text-foreground/80 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-brand" />
          <span>{formatDateLong(s.session_date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-brand" />
          <span>{formatTime(s.start_time)} – {formatTime(s.end_time)}</span>
        </div>
      </div>

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
                <li
                  key={p.user_id}
                  className="px-2.5 py-1 rounded-full bg-brand/10 text-brand text-xs font-medium"
                >
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
          <span className="text-[11px] text-muted-foreground">
            {full && !s.joined ? "This session is full." : ""}
          </span>
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
                  Are you sure you want to cancel your reservation for this session?
                  If fewer than 2 players remain, the session will be cancelled automatically.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Reservation</AlertDialogCancel>
                <AlertDialogAction onClick={() => onLeave(s.id)}>
                  Yes, Cancel Reservation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            disabled={busy || full}
            onClick={() => onJoin(s.id)}
            className="px-6 rounded-xl bg-brand text-white hover:bg-brand-dark font-bold shadow-lg shadow-brand/10"
          >
            {full ? "Full" : "Join Session"}
          </Button>
        )}
      </div>
    </div>
  );
}
