ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Update public_profiles view to expose avatar_url
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, display_name, ntrp_rating, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;