
CREATE EXTENSION IF NOT EXISTS "uuid-list";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════════════════════════════════════════════════════════
-- TABELA: profiles (estende auth.users do Supabase)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  username        TEXT UNIQUE,
  bio             TEXT,
  avatar_url      TEXT,
  cover_url       TEXT,
  phone           TEXT,
  location        TEXT,
  website         TEXT,
  status          TEXT DEFAULT 'offline' CHECK (status IN ('online','away','busy','offline')),
  last_seen       TIMESTAMPTZ DEFAULT NOW(),
  theme           TEXT DEFAULT 'dark',
  language        TEXT DEFAULT 'pt',
  notifications   BOOLEAN DEFAULT TRUE,
  two_factor      BOOLEAN DEFAULT FALSE,
  privacy_level   TEXT DEFAULT 'public' CHECK (privacy_level IN ('public','contacts','private')),
  email           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), '\s+', '_', 'g')) || '_' || substr(NEW.id::text, 1, 4)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════
-- TABELA: contacts
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.contacts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname    TEXT,
  is_blocked  BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, contact_id)
);

-- ════════════════════════════════════════════════════════════
-- TABELA: conversations
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.conversations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_group          BOOLEAN DEFAULT FALSE,
  group_name        TEXT,
  group_description TEXT,
  group_avatar      TEXT,
  created_by        UUID REFERENCES public.profiles(id),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════
-- TABELA: conversation_participants
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            TEXT DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ DEFAULT NOW(),
  is_muted        BOOLEAN DEFAULT FALSE,
  UNIQUE (conversation_id, user_id)
);

-- ════════════════════════════════════════════════════════════
-- TABELA: messages
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            TEXT,
  message_type    TEXT DEFAULT 'text' CHECK (message_type IN ('text','image','video','audio','file','location','sticker','deleted')),
  attachment_url  TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  thumbnail_url   TEXT,
  reply_to_id     UUID REFERENCES public.messages(id),
  reply_body      TEXT,
  is_read         BOOLEAN DEFAULT FALSE,
  is_edited       BOOLEAN DEFAULT FALSE,
  is_deleted      BOOLEAN DEFAULT FALSE,
  location_lat    DECIMAL,
  location_lng    DECIMAL,
  reactions       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at DESC);
CREATE INDEX messages_sender_idx ON public.messages(sender_id);

-- ════════════════════════════════════════════════════════════
-- TABELA: reactions
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

-- ════════════════════════════════════════════════════════════
-- TABELA: starred_messages
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.starred_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, message_id)
);

-- ════════════════════════════════════════════════════════════
-- TABELA: notifications
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('message','mention','group_invite','call','system','reaction')),
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- ════════════════════════════════════════════════════════════
-- TABELA: status_updates
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.status_updates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT,
  media_url   TEXT,
  media_type  TEXT DEFAULT 'text' CHECK (media_type IN ('text','image','video')),
  bg_color    TEXT,
  views       INTEGER DEFAULT 0,
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- TABELA: status_views
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.status_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status_id   UUID NOT NULL REFERENCES public.status_updates(id) ON DELETE CASCADE,
  viewer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (status_id, viewer_id)
);

-- ════════════════════════════════════════════════════════════
-- TABELA: call_logs
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.call_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id   UUID NOT NULL REFERENCES public.profiles(id),
  callee_id   UUID NOT NULL REFERENCES public.profiles(id),
  conversation_id UUID REFERENCES public.conversations(id),
  call_type   TEXT DEFAULT 'voice' CHECK (call_type IN ('voice','video')),
  status      TEXT DEFAULT 'outgoing' CHECK (status IN ('outgoing','incoming','missed','rejected','ended')),
  duration    INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);

-- ════════════════════════════════════════════════════════════
-- TABELA: signaling (WebRTC)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.signaling (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user   UUID NOT NULL REFERENCES public.profiles(id),
  to_user     UUID NOT NULL REFERENCES public.profiles(id),
  type        TEXT NOT NULL CHECK (type IN ('offer','answer','ice-candidate','call-end','call-reject')),
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- FUNÇÕES RPC
-- ════════════════════════════════════════════════════════════

-- Get or create 1:1 conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(user_a UUID, user_b UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
BEGIN
  SELECT cp1.conversation_id INTO conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = user_a AND cp2.user_id = user_b AND c.is_group = FALSE
  LIMIT 1;
  IF conv_id IS NULL THEN
    INSERT INTO conversations (is_group, updated_at) VALUES (FALSE, NOW()) RETURNING id INTO conv_id;
    INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES (conv_id, user_a, 'member'), (conv_id, user_b, 'member');
  END IF;
  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signaling ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by authenticated" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Conversations: participants can see their conversations
CREATE POLICY "Users see own conversations" ON public.conversations FOR SELECT USING (
  id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can update conversations" ON public.conversations FOR UPDATE USING (
  id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid() AND role = 'admin')
);

-- Participants
CREATE POLICY "Users see participants of own conversations" ON public.conversation_participants FOR SELECT USING (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
);
CREATE POLICY "Authenticated can insert participants" ON public.conversation_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own participation" ON public.conversation_participants FOR UPDATE USING (user_id = auth.uid());

-- Messages
CREATE POLICY "Users see messages in own conversations" ON public.messages FOR SELECT USING (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
);
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE USING (sender_id = auth.uid());
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (sender_id = auth.uid());

-- Reactions
CREATE POLICY "Users see reactions" ON public.reactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can react" ON public.reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own reactions" ON public.reactions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can remove own reactions" ON public.reactions FOR DELETE USING (user_id = auth.uid());

-- Notifications
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- Status
CREATE POLICY "Users see all status updates" ON public.status_updates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can create own status" ON public.status_updates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own status" ON public.status_updates FOR DELETE USING (user_id = auth.uid());

-- Call logs
CREATE POLICY "Users see own call logs" ON public.call_logs FOR SELECT USING (caller_id = auth.uid() OR callee_id = auth.uid());
CREATE POLICY "Users can create call logs" ON public.call_logs FOR INSERT WITH CHECK (caller_id = auth.uid());
CREATE POLICY "Users can update own call logs" ON public.call_logs FOR UPDATE USING (caller_id = auth.uid());

-- Signaling
CREATE POLICY "Users see own signals" ON public.signaling FOR SELECT USING (to_user = auth.uid() OR from_user = auth.uid());
CREATE POLICY "Users can send signals" ON public.signaling FOR INSERT WITH CHECK (from_user = auth.uid());

-- ════════════════════════════════════════════════════════════
-- REALTIME PUBLICATIONS
-- ════════════════════════════════════════════════════════════
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE messages, notifications, signaling, status_updates, reactions;

-- ════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ════════════════════════════════════════════════════════════
-- Execute no Storage do Supabase Dashboard:
-- 1. Criar bucket "avatars" (público)
-- 2. Criar bucket "media" (público)
-- 3. Criar bucket "files" (público)

-- Storage policies (após criar os buckets via Dashboard)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars','media','files'));
CREATE POLICY "Authenticated can upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id IN ('avatars','media','files'));
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);

-- ════════════════════════════════════════════════════════════
-- DADOS DE EXEMPLO (opcional - remova em produção)
-- ════════════════════════════════════════════════════════════
-- Os dados serão criados automaticamente quando usuários se cadastrarem

SELECT 'Talkio database schema created successfully! 🚀' AS result;
