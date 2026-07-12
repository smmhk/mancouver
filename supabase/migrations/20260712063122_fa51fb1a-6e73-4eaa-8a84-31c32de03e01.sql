
-- Guest players manually added by a session host
CREATE TABLE public.session_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name text NOT NULL CHECK (char_length(btrim(guest_name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_guests_session_idx ON public.session_guests(session_id);
CREATE UNIQUE INDEX session_guests_session_name_unique
  ON public.session_guests(session_id, lower(btrim(guest_name)));

GRANT SELECT, INSERT, DELETE ON public.session_guests TO authenticated;
GRANT ALL ON public.session_guests TO service_role;

ALTER TABLE public.session_guests ENABLE ROW LEVEL SECURITY;

-- Participants of a session can read the guest list
CREATE POLICY "Participants read guest list"
ON public.session_guests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = session_guests.session_id AND sp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = session_guests.session_id AND s.creator_id = auth.uid()
  )
);

-- Only the session creator can add guests, and only as themselves
CREATE POLICY "Creator inserts guests"
ON public.session_guests
FOR INSERT
TO authenticated
WITH CHECK (
  added_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = session_guests.session_id AND s.creator_id = auth.uid()
  )
);

-- Only the session creator can remove guests
CREATE POLICY "Creator deletes guests"
ON public.session_guests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = session_guests.session_id AND s.creator_id = auth.uid()
  )
);

-- When a real user joins a session, auto-remove any guest entry that matches
-- their display name (case-insensitive, trimmed) so we don't show duplicates.
CREATE OR REPLACE FUNCTION public.remove_matching_guest_on_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  SELECT display_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
  IF _name IS NULL OR btrim(_name) = '' THEN
    RETURN NEW;
  END IF;
  DELETE FROM public.session_guests
  WHERE session_id = NEW.session_id
    AND lower(btrim(guest_name)) = lower(btrim(_name));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS remove_matching_guest_on_join ON public.session_participants;
CREATE TRIGGER remove_matching_guest_on_join
AFTER INSERT ON public.session_participants
FOR EACH ROW EXECUTE FUNCTION public.remove_matching_guest_on_join();
