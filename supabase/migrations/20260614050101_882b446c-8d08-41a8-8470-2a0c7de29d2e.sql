CREATE OR REPLACE FUNCTION public.leave_session(_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.session_participants
  WHERE session_id = _session_id AND user_id = _uid;

  RETURN jsonb_build_object('success', true);
END;
$function$