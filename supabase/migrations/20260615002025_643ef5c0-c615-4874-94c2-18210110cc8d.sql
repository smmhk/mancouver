-- Allow all authenticated users to read non-sensitive profile fields via public_profiles view.
-- The view runs as definer (bypasses profiles RLS) and exposes only safe columns.
ALTER VIEW public.public_profiles SET (security_invoker = false);

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;