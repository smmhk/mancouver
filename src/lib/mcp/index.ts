import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCourts from "./tools/list-courts";
import listUpcomingSessions from "./tools/list-upcoming-sessions";
import listMySessions from "./tools/list-my-sessions";
import bookOrJoinSession from "./tools/book-or-join-session";
import leaveSession from "./tools/leave-session";
import getMyProfile from "./tools/get-my-profile";

// The OAuth issuer MUST be the direct Supabase host. Read the project ref from
// the build-time literal so publish keeps the .supabase.co issuer instead of
// the .lovable.cloud proxy form of SUPABASE_URL.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mancouver-mcp",
  title: "Mancouver Tennis",
  version: "0.1.0",
  instructions:
    "Tools for Mancouver, a Vancouver tennis community app. Use list_courts to discover courts, list_upcoming_sessions to browse open sessions, list_my_sessions for the signed-in user's schedule, book_or_join_session to reserve a court or join a matching session, and leave_session to cancel a spot. All actions run as the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCourts,
    listUpcomingSessions,
    listMySessions,
    bookOrJoinSession,
    leaveSession,
    getMyProfile,
  ],
});
