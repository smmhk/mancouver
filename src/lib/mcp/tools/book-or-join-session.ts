import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "book_or_join_session",
  title: "Book or join a session",
  description: "Book a tennis session at a court on a date/time. If a matching scheduled session already exists, the user joins it (subject to capacity); otherwise a new session is created. Returns status: created, joined, already_joined, or full.",
  inputSchema: {
    court_id: z.string().uuid().describe("Court id from list_courts."),
    session_date: z.string().describe("Session date in YYYY-MM-DD (Vancouver local)."),
    start_time: z.string().describe("Start time in HH:MM 24h format."),
    end_time: z.string().describe("End time in HH:MM 24h format."),
    max_players: z.number().int().min(2).max(8).describe("Maximum players for the session."),
    ntrp_min: z.number().optional().describe("Optional minimum NTRP rating."),
    ntrp_max: z.number().optional().describe("Optional maximum NTRP rating."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("book_or_join_session", {
      _court_id: input.court_id,
      _session_date: input.session_date,
      _start_time: input.start_time,
      _end_time: input.end_time,
      _max_players: input.max_players,
      _ntrp_min: input.ntrp_min ?? undefined,
      _ntrp_max: input.ntrp_max ?? undefined,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { result: data },
    };
  },
});
