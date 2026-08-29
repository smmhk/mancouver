CREATE TABLE public.session_reminder_sends (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT '24h',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, reminder_type)
);

GRANT SELECT ON public.session_reminder_sends TO authenticated;
GRANT ALL ON public.session_reminder_sends TO service_role;

ALTER TABLE public.session_reminder_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminder records"
ON public.session_reminder_sends
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_session_reminder_sends_session ON public.session_reminder_sends(session_id);