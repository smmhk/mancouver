
CREATE TABLE public.weather_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  weather_code integer NOT NULL,
  temp_max numeric(4,1),
  temp_min numeric(4,1),
  precipitation_probability integer,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(court_id, forecast_date)
);

GRANT SELECT ON public.weather_forecasts TO authenticated;
GRANT ALL ON public.weather_forecasts TO service_role;

ALTER TABLE public.weather_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forecasts readable by authenticated"
ON public.weather_forecasts FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_weather_forecasts_court_date
ON public.weather_forecasts (court_id, forecast_date);
