CREATE OR REPLACE FUNCTION public.leave_session(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _remaining int;
  _cancelled boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.session_participants
  WHERE session_id = _session_id AND user_id = _uid;

  SELECT COUNT(*) INTO _remaining
  FROM public.session_participants
  WHERE session_id = _session_id;

  IF _remaining = 0 THEN
    UPDATE public.sessions
    SET status = 'cancelled'
    WHERE id = _session_id;
    _cancelled := true;
  END IF;

  RETURN jsonb_build_object('success', true, 'cancelled', _cancelled, 'remaining', _remaining);
END;
$function$;