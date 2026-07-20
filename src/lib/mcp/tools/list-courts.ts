import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_courts",
  title: "List tennis courts",
  description: "List all tennis courts in the Mancouver directory, sorted alphabetically. Returns id, name, address, coordinates, and amenities for each court.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("courts")
      .select("id, name, address, city, latitude, longitude, num_courts, surface_type, has_parking, has_washroom, lighted")
      .order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { courts: data ?? [] },
    };
  },
});
void z;
