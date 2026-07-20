import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_upcoming_sessions",
  title: "List upcoming sessions",
  description: "List scheduled tennis sessions on or after today, sorted by date and start time. Includes court, timing, NTRP range, and participant counts.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Maximum number of sessions to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, session_date, start_time, end_time, max_players, ntrp_min, ntrp_max, notes, status, court_id, courts(name, address), session_participants(user_id)")
      .eq("status", "scheduled")
      .gte("session_date", today)
      .order("session_date")
      .order("start_time")
      .limit(limit ?? 25);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const shaped = (data ?? []).map((s) => ({
      id: s.id,
      date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      court: s.courts,
      max_players: s.max_players,
      participant_count: s.session_participants?.length ?? 0,
      ntrp_min: s.ntrp_min,
      ntrp_max: s.ntrp_max,
      notes: s.notes,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(shaped) }],
      structuredContent: { sessions: shaped },
    };
  },
});
