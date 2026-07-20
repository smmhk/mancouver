import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_sessions",
  title: "List my sessions",
  description: "List sessions the signed-in user has joined, sorted by date. Includes court and timing details.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const { data, error } = await supabase
      .from("session_participants")
      .select("session_id, sessions(id, session_date, start_time, end_time, status, court_id, courts(name, address))")
      .eq("user_id", uid);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const shaped = (data ?? []).map((r) => r.sessions).filter(Boolean);
    return {
      content: [{ type: "text", text: JSON.stringify(shaped) }],
      structuredContent: { sessions: shaped },
    };
  },
});
