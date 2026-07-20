import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "leave_session",
  title: "Leave a session",
  description: "Remove the signed-in user from a session they joined. If they were the last participant, the session is cancelled.",
  inputSchema: {
    session_id: z.string().uuid().describe("The session id to leave."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ session_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx).rpc("leave_session", { _session_id: session_id });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { result: data },
    };
  },
});
