-- One-time claim records for notification emails
CREATE TABLE public.email_notification_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, event_key)
);
GRANT ALL ON public.email_notification_sends TO service_role;
ALTER TABLE public.email_notification_sends ENABLE ROW LEVEL SECURITY;

-- Single-use tokens minted by database triggers/cron to authenticate hook calls
CREATE TABLE public.hook_tokens (
  token text PRIMARY KEY,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hook_tokens TO service_role;
ALTER TABLE public.hook_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS session_message boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.call_notify_hook(_path text, _body jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE
  _token text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  DELETE FROM public.hook_tokens WHERE created_at < now() - interval '1 hour';
  INSERT INTO public.hook_tokens (token, purpose) VALUES (_token, _path);
  PERFORM net.http_post(
    url := 'https://project--11d53338-4697-4ddd-b3d8-d3709335b683.lovable.app' || _path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _token),
    body := _body
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.call_notify_hook(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_session_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.call_notify_hook(
    '/api/public/hooks/session-joined',
    jsonb_build_object('session_id', NEW.session_id, 'user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_session_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.call_notify_hook(
    '/api/public/hooks/session-chat-message',
    jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_session_joined ON public.session_participants;
CREATE TRIGGER notify_session_joined
AFTER INSERT ON public.session_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_session_joined();

DROP TRIGGER IF EXISTS notify_session_message ON public.session_messages;
CREATE TRIGGER notify_session_message
AFTER INSERT ON public.session_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_session_message();