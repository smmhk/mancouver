CREATE TABLE public.favorite_courts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, court_id)
);

GRANT SELECT, INSERT, DELETE ON public.favorite_courts TO authenticated;
GRANT ALL ON public.favorite_courts TO service_role;

ALTER TABLE public.favorite_courts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own favorites"
  ON public.favorite_courts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users add their own favorites"
  ON public.favorite_courts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove their own favorites"
  ON public.favorite_courts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);