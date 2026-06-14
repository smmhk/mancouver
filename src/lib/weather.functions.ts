import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchDailyForecast } from "./weather";

/**
 * Persist daily forecasts for a court to the weather_forecasts table.
 * Used to back future notifications and analytics. Safe to call frequently:
 * uses upsert on (court_id, forecast_date).
 */
export const persistCourtForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courtId: string; lat: number; lng: number }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const forecasts = await fetchDailyForecast(data.lat, data.lng, 16);
    const rows = forecasts.map((f) => ({
      court_id: data.courtId,
      forecast_date: f.date,
      weather_code: f.code,
      temp_max: f.tempMax,
      temp_min: f.tempMin,
      precipitation_probability: f.precipProbability,
      fetched_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("weather_forecasts")
      .upsert(rows, { onConflict: "court_id,forecast_date" });
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });
