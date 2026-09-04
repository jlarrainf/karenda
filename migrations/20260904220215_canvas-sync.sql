ALTER TABLE public.events
  ADD COLUMN academic_activity_type TEXT;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_owner_identity_unique UNIQUE (id, owner_id);

ALTER TABLE public.events
  ADD CONSTRAINT events_owner_identity_unique UNIQUE (id, owner_id);

ALTER TABLE public.events
  ADD CONSTRAINT events_academic_activity_type_check CHECK (
    academic_activity_type IS NULL
    OR (
      kind = 'academic'
      AND academic_activity_type IN (
        'assignment',
        'graded_discussion',
        'quiz',
        'oral_assessment',
        'test',
        'exam',
        'other'
      )
    )
  );

CREATE TABLE public.canvas_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  canvas_base_url TEXT NOT NULL DEFAULT 'https://cursos.canvas.uc.cl'
    CHECK (canvas_base_url = 'https://cursos.canvas.uc.cl'),
  auth_mode TEXT NOT NULL DEFAULT 'personal_access_token'
    CHECK (auth_mode IN ('personal_access_token', 'oauth')),
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'expired', 'error', 'disabled')),
  time_zone TEXT NOT NULL DEFAULT 'America/Santiago'
    CHECK (time_zone = 'America/Santiago'),
  token_expires_at TIMESTAMPTZ NOT NULL,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  content_cursor_at TIMESTAMPTZ,
  sync_lock_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT canvas_connections_owner_identity_unique UNIQUE (id, owner_id),
  CONSTRAINT canvas_connections_error_length_check CHECK (
    last_error_code IS NULL OR length(last_error_code) <= 80
  ),
  CONSTRAINT canvas_connections_message_length_check CHECK (
    last_error_message IS NULL OR length(last_error_message) <= 500
  )
);

CREATE TABLE public.canvas_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  token_ciphertext TEXT NOT NULL CHECK (length(token_ciphertext) BETWEEN 24 AND 4096),
  token_iv TEXT NOT NULL CHECK (length(token_iv) BETWEEN 16 AND 64),
  key_version INTEGER NOT NULL DEFAULT 1 CHECK (key_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT canvas_credentials_connection_fk
    FOREIGN KEY (connection_id, owner_id)
    REFERENCES public.canvas_connections (id, owner_id)
    ON DELETE CASCADE
);

CREATE TABLE public.canvas_course_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  canvas_course_id TEXT NOT NULL CHECK (length(btrim(canvas_course_id)) BETWEEN 1 AND 120),
  subject_id UUID NOT NULL,
  canvas_name TEXT NOT NULL CHECK (length(btrim(canvas_name)) BETWEEN 1 AND 240),
  canvas_code TEXT,
  canvas_term_name TEXT,
  canvas_color TEXT CHECK (canvas_color IS NULL OR canvas_color ~ '^#[0-9A-Fa-f]{6}$'),
  source_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(source_snapshot) = 'object'),
  applied_subject_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(applied_subject_snapshot) = 'object'),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT canvas_course_links_owner_identity_unique UNIQUE (id, owner_id),
  CONSTRAINT canvas_course_links_connection_fk
    FOREIGN KEY (connection_id, owner_id)
    REFERENCES public.canvas_connections (id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT canvas_course_links_subject_fk
    FOREIGN KEY (subject_id, owner_id)
    REFERENCES public.subjects (id, owner_id)
    ON DELETE RESTRICT,
  CONSTRAINT canvas_course_links_external_unique
    UNIQUE (connection_id, canvas_course_id)
);

CREATE TABLE public.canvas_item_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  course_link_id UUID NOT NULL,
  canvas_item_type TEXT NOT NULL
    CHECK (canvas_item_type IN (
      'assignment', 'quiz', 'discussion_topic', 'calendar_event',
      'announcement', 'wiki_page'
    )),
  canvas_item_id TEXT NOT NULL CHECK (length(btrim(canvas_item_id)) BETWEEN 1 AND 240),
  event_id UUID,
  source_url TEXT,
  academic_activity_type TEXT
    CHECK (academic_activity_type IS NULL OR academic_activity_type IN (
      'assignment', 'graded_discussion', 'quiz', 'oral_assessment',
      'test', 'exam', 'other'
    )),
  source_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(source_snapshot) = 'object'),
  applied_event_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(applied_event_snapshot) = 'object'),
  last_source_hash TEXT CHECK (last_source_hash IS NULL OR last_source_hash ~ '^[0-9a-f]{64}$'),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT canvas_item_links_connection_fk
    FOREIGN KEY (connection_id, owner_id)
    REFERENCES public.canvas_connections (id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT canvas_item_links_course_fk
    FOREIGN KEY (course_link_id, owner_id)
    REFERENCES public.canvas_course_links (id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT canvas_item_links_event_fk
    FOREIGN KEY (event_id, owner_id)
    REFERENCES public.events (id, owner_id)
    ON DELETE SET NULL (event_id),
  CONSTRAINT canvas_item_links_external_unique
    UNIQUE (connection_id, canvas_item_type, canvas_item_id)
);

CREATE TABLE public.canvas_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  course_link_id UUID,
  canvas_course_id TEXT NOT NULL CHECK (length(btrim(canvas_course_id)) BETWEEN 1 AND 120),
  canvas_item_type TEXT,
  canvas_item_id TEXT,
  review_kind TEXT NOT NULL
    CHECK (review_kind IN (
      'course_mapping', 'event_create', 'event_update',
      'conflict', 'source_removed', 'undated'
    )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'ignored')),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  source_url TEXT,
  source_excerpt TEXT CHECK (source_excerpt IS NULL OR length(source_excerpt) <= 2000),
  academic_activity_type TEXT
    CHECK (academic_activity_type IS NULL OR academic_activity_type IN (
      'assignment', 'graded_discussion', 'quiz', 'oral_assessment',
      'test', 'exam', 'other'
    )),
  proposed_data JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(proposed_data) = 'object'),
  candidate_event_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  source_hash TEXT CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT canvas_review_items_connection_fk
    FOREIGN KEY (connection_id, owner_id)
    REFERENCES public.canvas_connections (id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT canvas_review_items_course_fk
    FOREIGN KEY (course_link_id, owner_id)
    REFERENCES public.canvas_course_links (id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT canvas_review_items_item_identity_check CHECK (
    (review_kind = 'course_mapping' AND canvas_item_type IS NULL AND canvas_item_id IS NULL)
    OR (review_kind <> 'course_mapping' AND canvas_item_type IS NOT NULL AND canvas_item_id IS NOT NULL)
  )
);

CREATE TABLE public.canvas_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  counts JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(counts) = 'object'),
  error_code TEXT CHECK (error_code IS NULL OR length(error_code) <= 80),
  error_message TEXT CHECK (error_message IS NULL OR length(error_message) <= 500),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT canvas_sync_runs_connection_fk
    FOREIGN KEY (connection_id, owner_id)
    REFERENCES public.canvas_connections (id, owner_id)
    ON DELETE CASCADE
);

CREATE INDEX canvas_connections_owner_status_idx
  ON public.canvas_connections (owner_id, status, next_sync_at);
CREATE INDEX canvas_credentials_owner_idx
  ON public.canvas_credentials (owner_id);
CREATE INDEX canvas_course_links_owner_subject_idx
  ON public.canvas_course_links (owner_id, subject_id);
CREATE INDEX canvas_item_links_owner_event_idx
  ON public.canvas_item_links (owner_id, event_id);
CREATE INDEX canvas_item_links_seen_idx
  ON public.canvas_item_links (connection_id, last_seen_at);
CREATE INDEX canvas_review_items_owner_queue_idx
  ON public.canvas_review_items (owner_id, status, review_kind, created_at);
CREATE UNIQUE INDEX canvas_review_items_pending_source_idx
  ON public.canvas_review_items (
    connection_id,
    canvas_course_id,
    COALESCE(canvas_item_type, ''),
    COALESCE(canvas_item_id, ''),
    review_kind
  )
  WHERE status = 'pending';
CREATE INDEX canvas_sync_runs_owner_started_idx
  ON public.canvas_sync_runs (owner_id, started_at DESC);
CREATE UNIQUE INDEX canvas_sync_runs_one_running_idx
  ON public.canvas_sync_runs (connection_id)
  WHERE status = 'running';

CREATE TRIGGER canvas_connections_set_updated_at
BEFORE UPDATE ON public.canvas_connections
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER canvas_credentials_set_updated_at
BEFORE UPDATE ON public.canvas_credentials
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER canvas_course_links_set_updated_at
BEFORE UPDATE ON public.canvas_course_links
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER canvas_item_links_set_updated_at
BEFORE UPDATE ON public.canvas_item_links
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER canvas_review_items_set_updated_at
BEFORE UPDATE ON public.canvas_review_items
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER canvas_connections_prevent_owner_change
BEFORE UPDATE ON public.canvas_connections
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER canvas_credentials_prevent_owner_change
BEFORE UPDATE ON public.canvas_credentials
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER canvas_course_links_prevent_owner_change
BEFORE UPDATE ON public.canvas_course_links
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER canvas_item_links_prevent_owner_change
BEFORE UPDATE ON public.canvas_item_links
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER canvas_review_items_prevent_owner_change
BEFORE UPDATE ON public.canvas_review_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

ALTER TABLE public.canvas_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_course_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_sync_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.canvas_connections,
  public.canvas_credentials,
  public.canvas_course_links,
  public.canvas_item_links,
  public.canvas_review_items,
  public.canvas_sync_runs
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.canvas_connections,
  public.canvas_course_links,
  public.canvas_item_links,
  public.canvas_review_items,
  public.canvas_sync_runs
TO authenticated;

CREATE POLICY canvas_connections_select_own
ON public.canvas_connections FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY canvas_course_links_select_own
ON public.canvas_course_links FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY canvas_item_links_select_own
ON public.canvas_item_links FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY canvas_review_items_select_own
ON public.canvas_review_items FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY canvas_sync_runs_select_own
ON public.canvas_sync_runs FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_canvas_review(
  p_review_item_id UUID,
  p_decision TEXT,
  p_target_id UUID DEFAULT NULL,
  p_overrides JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_owner_id UUID := auth.uid();
  review_record public.canvas_review_items%ROWTYPE;
  course_record public.canvas_course_links%ROWTYPE;
  event_record public.events%ROWTYPE;
  resolved_subject_id UUID;
  resolved_event_id UUID;
  merged_data JSONB;
  subject_payload JSONB;
  snapshot JSONB;
BEGIN
  IF request_owner_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Se requiere una sesión autenticada.';
  END IF;

  IF p_decision NOT IN (
    'link_existing', 'create_subject', 'create_event', 'apply_update', 'ignore'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La decisión de revisión no es válida.';
  END IF;

  SELECT * INTO review_record
  FROM public.canvas_review_items
  WHERE id = p_review_item_id
    AND owner_id = request_owner_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'No se encontró la revisión pendiente.';
  END IF;

  IF p_decision = 'ignore' THEN
    UPDATE public.canvas_review_items
    SET status = 'ignored', resolved_at = NOW()
    WHERE id = review_record.id;
    RETURN jsonb_build_object('review_item_id', review_record.id, 'status', 'ignored');
  END IF;

  IF review_record.review_kind = 'course_mapping' THEN
    IF p_decision = 'link_existing' THEN
      IF p_target_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.subjects
        WHERE id = p_target_id AND owner_id = request_owner_id
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'La asignatura elegida no está disponible.';
      END IF;
      resolved_subject_id := p_target_id;
    ELSIF p_decision = 'create_subject' THEN
      subject_payload := review_record.proposed_data || COALESCE(p_overrides, '{}'::JSONB);
      INSERT INTO public.subjects (owner_id, name, code, abbreviation, color)
      VALUES (
        request_owner_id,
        btrim(subject_payload->>'name'),
        btrim(subject_payload->>'code'),
        btrim(subject_payload->>'abbreviation'),
        COALESCE(NULLIF(subject_payload->>'color', ''), '#2F625A')
      )
      RETURNING id INTO resolved_subject_id;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La decisión no corresponde a un curso.';
    END IF;

    INSERT INTO public.canvas_course_links (
      connection_id,
      owner_id,
      canvas_course_id,
      subject_id,
      canvas_name,
      canvas_code,
      canvas_term_name,
      canvas_color,
      source_snapshot,
      applied_subject_snapshot
    ) VALUES (
      review_record.connection_id,
      request_owner_id,
      review_record.canvas_course_id,
      resolved_subject_id,
      review_record.title,
      review_record.proposed_data->>'code',
      review_record.proposed_data->>'term_name',
      NULLIF(review_record.proposed_data->>'color', ''),
      review_record.proposed_data,
      (
        SELECT jsonb_build_object(
          'name', name,
          'code', code,
          'abbreviation', abbreviation,
          'color', color
        )
        FROM public.subjects
        WHERE id = resolved_subject_id AND owner_id = request_owner_id
      )
    )
    ON CONFLICT (connection_id, canvas_course_id) DO UPDATE
    SET subject_id = EXCLUDED.subject_id,
        canvas_name = EXCLUDED.canvas_name,
        canvas_code = EXCLUDED.canvas_code,
        canvas_term_name = EXCLUDED.canvas_term_name,
        canvas_color = EXCLUDED.canvas_color,
        source_snapshot = EXCLUDED.source_snapshot,
        applied_subject_snapshot = EXCLUDED.applied_subject_snapshot,
        last_seen_at = NOW()
    RETURNING id INTO resolved_event_id;

    UPDATE public.canvas_review_items
    SET course_link_id = resolved_event_id
    WHERE owner_id = request_owner_id
      AND connection_id = review_record.connection_id
      AND canvas_course_id = review_record.canvas_course_id
      AND status = 'pending';

    UPDATE public.canvas_review_items
    SET status = 'applied', resolved_at = NOW()
    WHERE id = review_record.id;

    RETURN jsonb_build_object(
      'review_item_id', review_record.id,
      'status', 'applied',
      'subject_id', resolved_subject_id,
      'course_link_id', resolved_event_id
    );
  END IF;

  IF review_record.course_link_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Vincula primero la asignatura de Canvas.';
  END IF;

  SELECT * INTO course_record
  FROM public.canvas_course_links
  WHERE id = review_record.course_link_id
    AND owner_id = request_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'La asignatura vinculada no está disponible.';
  END IF;

  merged_data := COALESCE(review_record.proposed_data->'changes', review_record.proposed_data)
    || COALESCE(p_overrides, '{}'::JSONB);

  IF p_decision = 'link_existing' THEN
    IF p_target_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Elige un evento de Karenda.';
    END IF;

    SELECT * INTO event_record
    FROM public.events
    WHERE id = p_target_id
      AND owner_id = request_owner_id
      AND kind = 'academic'
      AND subject_id = course_record.subject_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'El evento elegido no está disponible.';
    END IF;
    resolved_event_id := event_record.id;

    UPDATE public.events
    SET academic_activity_type = COALESCE(
      NULLIF(p_overrides->>'academic_activity_type', ''),
      review_record.academic_activity_type,
      academic_activity_type
    )
    WHERE id = resolved_event_id;
  ELSIF p_decision = 'create_event' THEN
    IF NULLIF(merged_data->>'start_at', '') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La actividad necesita una fecha antes de crear el evento.';
    END IF;

    INSERT INTO public.events (
      owner_id,
      kind,
      title,
      subject_id,
      personal_group_id,
      start_at,
      end_at,
      is_all_day,
      status,
      location,
      description,
      academic_activity_type
    ) VALUES (
      request_owner_id,
      'academic',
      btrim(merged_data->>'title'),
      course_record.subject_id,
      NULL,
      (merged_data->>'start_at')::TIMESTAMPTZ,
      NULLIF(merged_data->>'end_at', '')::TIMESTAMPTZ,
      COALESCE((merged_data->>'is_all_day')::BOOLEAN, FALSE),
      CASE WHEN merged_data->>'status' = 'completed' THEN 'completed' ELSE 'pending' END,
      NULLIF(merged_data->>'location', ''),
      NULLIF(merged_data->>'description', ''),
      COALESCE(
        NULLIF(merged_data->>'academic_activity_type', ''),
        review_record.academic_activity_type,
        'other'
      )
    )
    RETURNING id INTO resolved_event_id;
  ELSIF p_decision = 'apply_update' THEN
    resolved_event_id := COALESCE(
      p_target_id,
      NULLIF(review_record.proposed_data->>'event_id', '')::UUID,
      (
        SELECT event_id
        FROM public.canvas_item_links
        WHERE connection_id = review_record.connection_id
          AND canvas_item_type = review_record.canvas_item_type
          AND canvas_item_id = review_record.canvas_item_id
      )
    );

    IF resolved_event_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Elige el evento que debe actualizarse.';
    END IF;

    SELECT * INTO event_record
    FROM public.events
    WHERE id = resolved_event_id
      AND owner_id = request_owner_id
      AND kind = 'academic'
      AND subject_id = course_record.subject_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'El evento que debe actualizarse no está disponible.';
    END IF;

    IF review_record.review_kind <> 'source_removed' THEN
      UPDATE public.events
      SET title = CASE WHEN merged_data ? 'title' THEN btrim(merged_data->>'title') ELSE title END,
          start_at = CASE WHEN merged_data ? 'start_at' THEN (merged_data->>'start_at')::TIMESTAMPTZ ELSE start_at END,
          end_at = CASE WHEN merged_data ? 'end_at' THEN NULLIF(merged_data->>'end_at', '')::TIMESTAMPTZ ELSE end_at END,
          is_all_day = CASE WHEN merged_data ? 'is_all_day' THEN (merged_data->>'is_all_day')::BOOLEAN ELSE is_all_day END,
          status = CASE
            WHEN status = 'completed' THEN 'completed'
            WHEN merged_data->>'status' = 'completed' THEN 'completed'
            ELSE status
          END,
          location = CASE WHEN merged_data ? 'location' THEN NULLIF(merged_data->>'location', '') ELSE location END,
          description = CASE WHEN merged_data ? 'description' THEN NULLIF(merged_data->>'description', '') ELSE description END,
          academic_activity_type = CASE
            WHEN merged_data ? 'academic_activity_type'
              THEN NULLIF(merged_data->>'academic_activity_type', '')
            ELSE COALESCE(review_record.academic_activity_type, academic_activity_type)
          END
      WHERE id = resolved_event_id;
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La decisión no corresponde a una actividad.';
  END IF;

  SELECT jsonb_build_object(
    'title', title,
    'start_at', start_at,
    'end_at', end_at,
    'is_all_day', is_all_day,
    'status', status,
    'location', location,
    'description', description,
    'academic_activity_type', academic_activity_type
  ) INTO snapshot
  FROM public.events
  WHERE id = resolved_event_id AND owner_id = request_owner_id;

  INSERT INTO public.canvas_item_links (
    connection_id,
    owner_id,
    course_link_id,
    canvas_item_type,
    canvas_item_id,
    event_id,
    source_url,
    academic_activity_type,
    source_snapshot,
    applied_event_snapshot,
    last_source_hash,
    last_seen_at
  ) VALUES (
    review_record.connection_id,
    request_owner_id,
    review_record.course_link_id,
    review_record.canvas_item_type,
    review_record.canvas_item_id,
    resolved_event_id,
    review_record.source_url,
    COALESCE(
      NULLIF(merged_data->>'academic_activity_type', ''),
      review_record.academic_activity_type
    ),
    COALESCE(review_record.proposed_data->'remote', review_record.proposed_data),
    snapshot,
    review_record.source_hash,
    NOW()
  )
  ON CONFLICT (connection_id, canvas_item_type, canvas_item_id) DO UPDATE
  SET course_link_id = EXCLUDED.course_link_id,
      event_id = EXCLUDED.event_id,
      source_url = EXCLUDED.source_url,
      academic_activity_type = EXCLUDED.academic_activity_type,
      source_snapshot = EXCLUDED.source_snapshot,
      applied_event_snapshot = EXCLUDED.applied_event_snapshot,
      last_source_hash = EXCLUDED.last_source_hash,
      last_seen_at = NOW();

  UPDATE public.canvas_review_items
  SET status = 'applied', resolved_at = NOW()
  WHERE id = review_record.id;

  RETURN jsonb_build_object(
    'review_item_id', review_record.id,
    'status', 'applied',
    'event_id', resolved_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_canvas_review(UUID, TEXT, UUID, JSONB)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_canvas_review(UUID, TEXT, UUID, JSONB)
TO authenticated;
