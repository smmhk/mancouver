
CREATE TABLE public.session_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX session_messages_session_created_idx ON public.session_messages (session_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.session_messages TO authenticated;
GRANT ALL ON public.session_messages TO service_role;

ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read session messages"
ON public.session_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = session_messages.session_id
      AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Participants can post messages"
ON public.session_messages FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = session_messages.session_id
      AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own messages"
ON public.session_messages FOR DELETE
TO authenticated
USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;
ALTER TABLE public.session_messages REPLICA IDENTITY FULL;
