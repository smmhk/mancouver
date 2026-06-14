
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS lighted boolean,
  ADD COLUMN IF NOT EXISTS has_washroom boolean,
  ADD COLUMN IF NOT EXISTS has_parking boolean,
  ADD COLUMN IF NOT EXISTS surface_type text,
  ADD COLUMN IF NOT EXISTS city text;

CREATE UNIQUE INDEX IF NOT EXISTS courts_name_address_unique
  ON public.courts (lower(name), lower(coalesce(address, '')));
