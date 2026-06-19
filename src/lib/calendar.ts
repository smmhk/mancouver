// Utilities for generating calendar event data (Apple .ics, Google, Outlook)
// for tennis sessions. Default reminder: 1 hour before start.

export interface CalendarEventInput {
  id: string;
  title: string;
  description?: string;
  location?: string;
  /** YYYY-MM-DD (local Vancouver date) */
  date: string;
  /** HH:MM or HH:MM:SS (local time) */
  startTime: string;
  /** HH:MM or HH:MM:SS (local time) */
  endTime: string;
  /** Reminder offset in minutes before start. Default 60. */
  reminderMinutes?: number;
  url?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function parseLocal(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** Local-time format YYYYMMDDTHHMMSS (used with TZID). */
function toLocalICS(d: Date): string {
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/** UTC format YYYYMMDDTHHMMSSZ (for Google/Outlook URLs and DTSTAMP). */
function toUTCICS(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// Minimal VTIMEZONE for America/Vancouver — covers current US DST rules.
const VANCOUVER_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Vancouver",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0800",
  "TZOFFSETTO:-0700",
  "TZNAME:PDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0800",
  "TZNAME:PST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

export function buildICS(e: CalendarEventInput): string {
  const start = parseLocal(e.date, e.startTime);
  const end = parseLocal(e.date, e.endTime);
  const reminder = e.reminderMinutes ?? 60;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mancouver Tennis//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    VANCOUVER_VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:session-${e.id}@mancouvertennis.live`,
    `DTSTAMP:${toUTCICS(new Date())}`,
    `DTSTART;TZID=America/Vancouver:${toLocalICS(start)}`,
    `DTEND;TZID=America/Vancouver:${toLocalICS(end)}`,
    `SUMMARY:${escapeICS(e.title)}`,
  ];
  if (e.location) lines.push(`LOCATION:${escapeICS(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeICS(e.description)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  if (reminder > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeICS(e.title)}`,
      `TRIGGER:-PT${reminder}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function buildGoogleCalendarUrl(e: CalendarEventInput): string {
  const start = parseLocal(e.date, e.startTime);
  const end = parseLocal(e.date, e.endTime);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toUTCICS(start)}/${toUTCICS(end)}`,
  });
  if (e.location) params.set("location", e.location);
  if (e.description) params.set("details", e.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarUrl(e: CalendarEventInput): string {
  const start = parseLocal(e.date, e.startTime);
  const end = parseLocal(e.date, e.endTime);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (e.location) params.set("location", e.location);
  if (e.description) params.set("body", e.description);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function downloadICS(e: CalendarEventInput) {
  const ics = buildICS(e);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tennis-session-${e.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
