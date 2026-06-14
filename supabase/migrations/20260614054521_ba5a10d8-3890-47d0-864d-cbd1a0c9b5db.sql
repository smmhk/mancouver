
-- 1) Restrict profiles SELECT to own row
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2) Safe public view for displaying other players
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, display_name, ntrp_rating
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- 3) Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_session(uuid) TO authenticated;
