export interface SessionListItem {
  id: string;
  session_date: string; // YYYY-MM-DD
  start_time: string;   // HH:MM[:SS]
  end_time: string;     // HH:MM[:SS]
  status?: string;
}

export type SessionLiveStatus = "upcoming" | "active" | "past";

/**
 * Returns the current wall-clock time in America/Vancouver as a
 * lexicographically-comparable string: "YYYY-MM-DDTHH:MM:SS".
 */
export function getVancouverNowString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  // hour can come back as "24" at midnight in some runtimes; normalize.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;
}

function normalizeTime(t: string): string {
  // Ensure HH:MM:SS
  const parts = t.split(":");
  const hh = (parts[0] ?? "00").padStart(2, "0");
  const mm = (parts[1] ?? "00").padStart(2, "0");
  const ss = (parts[2] ?? "00").padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function getSessionLiveStatus(
  s: SessionListItem,
  nowVancouver: string = getVancouverNowString(),
): SessionLiveStatus {
  const start = `${s.session_date}T${normalizeTime(s.start_time)}`;
  const end = `${s.session_date}T${normalizeTime(s.end_time)}`;
  if (nowVancouver >= end) return "past";
  if (nowVancouver >= start) return "active";
  return "upcoming";
}

/**
 * Filters to only show non-cancelled sessions that are upcoming or
 * currently active in Vancouver local time. Sorts active first, then
 * upcoming by nearest start time.
 */
export function filterAndSortSessions<T extends SessionListItem>(sessions: T[]): T[] {
  const now = getVancouverNowString();
  return sessions
    .filter((s) => s.status !== "cancelled")
    .filter((s) => getSessionLiveStatus(s, now) !== "past")
    .sort((a, b) => {
      const sa = getSessionLiveStatus(a, now);
      const sb = getSessionLiveStatus(b, now);
      if (sa !== sb) return sa === "active" ? -1 : 1;
      const dateCompare = a.session_date.localeCompare(b.session_date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
    });
}
