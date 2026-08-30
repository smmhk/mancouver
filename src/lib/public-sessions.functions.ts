import { createServerFn } from "@tanstack/react-start";

export type PublicSession = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_players: number;
  ntrp_min: number | null;
  ntrp_max: number | null;
  status: string;
  court: { id: string; name: string; latitude: number; longitude: number } | null;
  participant_count: number;
  guest_count: number;
};

/**
 * Read-only, anonymized list of upcoming sessions for guest (not signed-in)
 * visitors. Never exposes user ids, emails, or display names, and performs no
 * writes. Guests can browse; joining/creating requires an account.
 */
export const listPublicSessions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSession[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select(
        `id, session_date, start_time, end_time, max_players, ntrp_min, ntrp_max, status,
         court:courts ( id, name, latitude, longitude ),
         participants:session_participants ( user_id ),
         guests:session_guests ( id )` as never,
      )
      .gte("session_date", cutoff)
      .neq("status", "cancelled")
      .order("session_date")
      .order("start_time");

    if (error) throw new Error(error.message);

    return ((data ?? []) as unknown as any[]).map((s) => ({
      id: s.id,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      max_players: s.max_players,
      ntrp_min: s.ntrp_min,
      ntrp_max: s.ntrp_max,
      status: s.status,
      court: s.court
        ? { id: s.court.id, name: s.court.name, latitude: s.court.latitude, longitude: s.court.longitude }
        : null,
      participant_count: s.participants?.length ?? 0,
      guest_count: s.guests?.length ?? 0,
    }));
  },
);
