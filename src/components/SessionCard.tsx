import { format } from "date-fns";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

function formatTime(t: string) {
  // "HH:MM:SS" -> "h:mm a"
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, "h:mm a");
}

function formatDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return format(date, "EEE, MMM d");
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
    <div className="bg-card rounded-2xl p-5 border border-border flex flex-col sm:flex-row gap-4 sm:items-center">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="px-2 py-0.5 rounded bg-brand/10 text-brand text-[10px] font-bold uppercase tracking-wider">
            {ntrpLabel(s.ntrp_min, s.ntrp_max)}
          </span>
          <span className="text-muted-foreground text-[10px] uppercase tracking-wide truncate">
            {s.court?.name ?? "Court TBA"}
          </span>
        </div>
        <h3 className="text-base sm:text-lg font-bold leading-tight">
          {formatDateLabel(s.session_date)}, {formatTime(s.start_time)} — {formatTime(s.end_time)}
        </h3>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          <span>{s.participant_count} / {s.max_players} players</span>
        </div>
      </div>
      {s.is_creator ? (
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand sm:text-right">Your session</span>
      ) : s.joined ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onLeave(s.id)}
          className="sm:w-auto rounded-xl border-border bg-transparent hover:bg-background"
        >
          Leave
        </Button>
      ) : (
        <Button
          disabled={busy || full}
          onClick={() => onJoin(s.id)}
          className="sm:w-auto px-6 rounded-xl bg-brand text-white hover:bg-brand-dark font-bold shadow-lg shadow-brand/10"
        >
          {full ? "Full" : "I'm Down"}
        </Button>
      )}
    </div>
  );
}
