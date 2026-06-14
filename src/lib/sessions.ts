export interface SessionListItem {
  id: string;
  session_date: string; // YYYY-MM-DD
  start_time: string;   // HH:MM
  end_time: string;     // HH:MM
  status?: string;
}

/**
 * Filters a session list to only show:
 * - Non-cancelled sessions
 * - Sessions that haven't ended more than 24 hours ago
 *
 * Sorts by session_date then start_time in ascending order (soonest first).
 */
export function filterAndSortSessions<T extends SessionListItem>(
  sessions: T[],
): T[] {
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;

  return sessions
    .filter((s) => s.status !== "cancelled")
    .filter((s) => {
      const [y, mo, d] = s.session_date.split("-").map(Number);
      const [h, m] = s.end_time.split(":").map(Number);
      const endDateTime = new Date(y, mo - 1, d, h, m);
      return endDateTime.getTime() >= now - ms24h;
    })
    .sort((a, b) => {
      const dateCompare = a.session_date.localeCompare(b.session_date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
    });
}
