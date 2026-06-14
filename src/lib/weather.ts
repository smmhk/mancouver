// Weather utilities — Open-Meteo (free, no API key).
// https://open-meteo.com/en/docs

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  code: number; // WMO weather code
  tempMax: number | null;
  tempMin: number | null;
  precipProbability: number | null;
}

export const VANCOUVER_COORDS = { lat: 49.2827, lng: -123.1207 };

// WMO weather interpretation codes → emoji + short label
// https://open-meteo.com/en/docs#weathervariables
export function wmoToDisplay(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "Sunny" };
  if (code === 1) return { icon: "🌤️", label: "Mostly Sunny" };
  if (code === 2) return { icon: "⛅", label: "Partly Cloudy" };
  if (code === 3) return { icon: "☁️", label: "Cloudy" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Fog" };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", label: "Drizzle" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: "🌧️", label: "Rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: "❄️", label: "Snow" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈️", label: "Storm" };
  return { icon: "🌥️", label: "Cloudy" };
}

export function isSevereWeather(code: number, precipProb: number | null): boolean {
  if ([95, 96, 99, 65, 67, 75, 82, 86].includes(code)) return true;
  if ([61, 63, 80, 81].includes(code) && (precipProb ?? 0) >= 60) return true;
  return false;
}

export async function fetchDailyForecast(
  lat: number,
  lng: number,
  days = 16,
): Promise<DailyForecast[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  url.searchParams.set("timezone", "America/Vancouver");
  url.searchParams.set("forecast_days", String(days));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  const json = await res.json();
  const d = json.daily ?? {};
  const dates: string[] = d.time ?? [];
  return dates.map((date, i) => ({
    date,
    code: d.weather_code?.[i] ?? 3,
    tempMax: d.temperature_2m_max?.[i] ?? null,
    tempMin: d.temperature_2m_min?.[i] ?? null,
    precipProbability: d.precipitation_probability_max?.[i] ?? null,
  }));
}
