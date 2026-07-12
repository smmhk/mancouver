DROP POLICY IF EXISTS "Creator can add guests" ON public.session_guests;
DROP POLICY IF EXISTS "Creator can remove guests" ON public.session_guests;

CREATE POLICY "Participants can add guests"
ON public.session_guests
FOR INSERT
TO authenticated
WITH CHECK (
  added_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = session_guests.session_id AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Participants can remove guests"
ON public.session_guests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = session_guests.session_id AND sp.user_id = auth.uid()
  )
);