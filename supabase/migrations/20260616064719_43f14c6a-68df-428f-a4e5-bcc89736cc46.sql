
-- Prevent duplicate active sessions for same date/time/court
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_slot
  ON public.sessions (session_date, start_time, end_time, court_id)
  WHERE status = 'scheduled';

CREATE OR REPLACE FUNCTION public.book_or_join_session(
  _court_id uuid,
  _session_date date,
  _start_time time,
  _end_time time,
  _max_players int,
  _ntrp_min numeric DEFAULT NULL,
  _ntrp_max numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _session_id uuid;
  _existing_max int;
  _count int;
  _already boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock matching active session if any
  SELECT id, max_players INTO _session_id, _existing_max
  FROM public.sessions
  WHERE session_date = _session_date
    AND start_time = _start_time
    AND end_time = _end_time
    AND court_id = _court_id
    AND status = 'scheduled'
  FOR UPDATE;

  IF _session_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.session_participants
      WHERE session_id = _session_id AND user_id = _uid
    ) INTO _already;

    IF _already THEN
      RETURN jsonb_build_object('status', 'already_joined', 'session_id', _session_id);
    END IF;

    SELECT COUNT(*) INTO _count FROM public.session_participants WHERE session_id = _session_id;
    IF _count >= _existing_max THEN
      RETURN jsonb_build_object('status', 'full', 'session_id', _session_id);
    END IF;

    INSERT INTO public.session_participants (session_id, user_id) VALUES (_session_id, _uid);
    RETURN jsonb_build_object('status', 'joined', 'session_id', _session_id);
  END IF;

  INSERT INTO public.sessions (
    creator_id, court_id, session_date, start_time, end_time, max_players, ntrp_min, ntrp_max
  ) VALUES (
    _uid, _court_id, _session_date, _start_time, _end_time, _max_players, _ntrp_min, _ntrp_max
  ) RETURNING id INTO _session_id;

  INSERT INTO public.session_participants (session_id, user_id) VALUES (_session_id, _uid);
  RETURN jsonb_build_object('status', 'created', 'session_id', _session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_or_join_session(uuid, date, time, time, int, numeric, numeric) TO authenticated;
