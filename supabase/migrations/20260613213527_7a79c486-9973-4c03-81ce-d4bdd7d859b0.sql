
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  ntrp_rating NUMERIC(2,1),
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- COURTS
CREATE TABLE public.courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  num_courts INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courts TO authenticated, anon;
GRANT ALL ON public.courts TO service_role;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courts readable by everyone" ON public.courts FOR SELECT USING (true);

-- SESSIONS
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_players INT NOT NULL DEFAULT 4,
  ntrp_min NUMERIC(2,1),
  ntrp_max NUMERIC(2,1),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_date ON public.sessions(session_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions viewable by authenticated" ON public.sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create their sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators update their sessions" ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators delete their sessions" ON public.sessions FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- PARTICIPANTS
CREATE TABLE public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);
CREATE INDEX idx_participants_session ON public.session_participants(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_participants TO authenticated;
GRANT ALL ON public.session_participants TO service_role;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants viewable by authenticated" ON public.session_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users join sessions" ON public.session_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave own participation" ON public.session_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PUSH SUBSCRIPTIONS
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth_key TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, ntrp_rating)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    NULLIF(NEW.raw_user_meta_data->>'ntrp_rating','')::numeric
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed Vancouver public tennis courts
INSERT INTO public.courts (name, address, latitude, longitude, num_courts) VALUES
  ('Stanley Park Tennis Courts', '1925 Beach Ave, Vancouver', 49.2932, -123.1419, 17),
  ('Kitsilano Beach Tennis Courts', '1499 Arbutus St, Vancouver', 49.2733, -123.1531, 10),
  ('Queen Elizabeth Park Courts', '4600 Cambie St, Vancouver', 49.2418, -123.1126, 17),
  ('Hillcrest / Riley Park Courts', '4575 Clancy Loranger Way, Vancouver', 49.2444, -123.1083, 6),
  ('Jericho Beach Tennis Courts', '3941 Point Grey Rd, Vancouver', 49.2725, -123.1936, 4),
  ('Memorial South Park', '5955 Ross St, Vancouver', 49.2233, -123.0945, 6),
  ('Trafalgar Park', '2610 W 23rd Ave, Vancouver', 49.2519, -123.1671, 4),
  ('Connaught Park', '2390 W 10th Ave, Vancouver', 49.2636, -123.1591, 4),
  ('Strathcona Park', '857 Malkin Ave, Vancouver', 49.2786, -123.0892, 4),
  ('Sunset Park', '404 E 51st Ave, Vancouver', 49.2225, -123.1014, 4);
