CREATE TABLE public.koreader_habit_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL,
  device_token_id UUID NOT NULL,
  metric_key TEXT NOT NULL CHECK (
    metric_key IN (
      'reading_pages',
      'reading_minutes',
      'books_completed',
      'anki_cards_reviewed'
    )
  ),
  source_unit TEXT NOT NULL CHECK (
    source_unit IN ('pages', 'minutes', 'books', 'cards')
  ),
  target_unit TEXT NOT NULL CHECK (length(btrim(target_unit)) BETWEEN 1 AND 80),
  conversion_factor NUMERIC NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  timezone TEXT NOT NULL CHECK (length(btrim(timezone)) BETWEEN 1 AND 80),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'revoked')),
  auto_created BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT koreader_habit_links_owner_identity_unique UNIQUE (id, owner_id),
  CONSTRAINT koreader_habit_links_habit_fk
    FOREIGN KEY (habit_id, owner_id)
    REFERENCES public.habits (id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT koreader_habit_links_device_fk
    FOREIGN KEY (device_token_id)
    REFERENCES public.device_tokens (id)
    ON DELETE CASCADE,
  CONSTRAINT koreader_habit_links_metric_unit_check CHECK (
    (metric_key = 'reading_pages' AND source_unit = 'pages')
    OR (metric_key = 'reading_minutes' AND source_unit = 'minutes')
    OR (metric_key = 'books_completed' AND source_unit = 'books')
    OR (metric_key = 'anki_cards_reviewed' AND source_unit = 'cards')
  ),
  CONSTRAINT koreader_habit_links_revoked_at_check CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL)
    OR (status <> 'revoked')
  )
);

ALTER TABLE public.habit_logs
  ADD COLUMN koreader_link_id UUID;

ALTER TABLE public.habit_logs
  ADD CONSTRAINT habit_logs_koreader_link_fk
  FOREIGN KEY (koreader_link_id, owner_id)
  REFERENCES public.koreader_habit_links (id, owner_id)
  ON DELETE RESTRICT;

ALTER TABLE public.habit_logs
  ADD CONSTRAINT habit_logs_source_link_check CHECK (
    (source = 'manual' AND koreader_link_id IS NULL)
    OR (source = 'koreader' AND koreader_link_id IS NOT NULL)
  );

CREATE INDEX koreader_habit_links_owner_idx
  ON public.koreader_habit_links (owner_id, status, metric_key);

CREATE INDEX koreader_habit_links_device_idx
  ON public.koreader_habit_links (device_token_id, status, metric_key);

CREATE UNIQUE INDEX koreader_habit_links_active_metric_idx
  ON public.koreader_habit_links (owner_id, metric_key)
  WHERE status = 'active';

CREATE UNIQUE INDEX habit_logs_koreader_day_idx
  ON public.habit_logs (koreader_link_id, local_date)
  WHERE koreader_link_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_koreader_habit_link_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.device_tokens
    WHERE id = NEW.device_token_id
      AND owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'El dispositivo no pertenece a la cuenta.';
  END IF;

  IF NEW.status = 'revoked' AND NEW.revoked_at IS NULL THEN
    NEW.revoked_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER koreader_habit_links_validate_references
BEFORE INSERT OR UPDATE OF owner_id, habit_id, device_token_id, status
ON public.koreader_habit_links
FOR EACH ROW EXECUTE FUNCTION public.validate_koreader_habit_link_references();

CREATE TRIGGER koreader_habit_links_set_updated_at
BEFORE UPDATE ON public.koreader_habit_links
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER koreader_habit_links_prevent_owner_change
BEFORE UPDATE ON public.koreader_habit_links
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

ALTER TABLE public.koreader_habit_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.koreader_habit_links FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS habit_logs_insert_own ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_update_own ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_delete_own ON public.habit_logs;

CREATE POLICY habit_logs_insert_manual_own ON public.habit_logs
FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()) AND source = 'manual');

CREATE POLICY habit_logs_update_manual_own ON public.habit_logs
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()) AND source = 'manual')
WITH CHECK (owner_id = (SELECT auth.uid()) AND source = 'manual');

CREATE POLICY habit_logs_delete_manual_own ON public.habit_logs
FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()) AND source = 'manual');

ALTER TABLE public.device_pairing_codes
  ADD COLUMN scopes TEXT[] NOT NULL DEFAULT ARRAY['read:snapshot']::TEXT[];

ALTER TABLE public.device_pairing_codes
  ADD CONSTRAINT device_pairing_codes_scopes_check CHECK (
    cardinality(scopes) > 0
    AND 'read:snapshot' = ANY(scopes)
    AND scopes <@ ARRAY['read:snapshot', 'write:events', 'write:habit_logs']::TEXT[]
  );

ALTER TABLE public.device_tokens
  DROP CONSTRAINT device_tokens_scopes_check;

ALTER TABLE public.device_tokens
  ADD CONSTRAINT device_tokens_scopes_check CHECK (
    cardinality(scopes) > 0
    AND 'read:snapshot' = ANY(scopes)
    AND scopes <@ ARRAY['read:snapshot', 'write:events', 'write:habit_logs']::TEXT[]
  );

CREATE OR REPLACE FUNCTION public.redeem_device_pairing_code(
  p_code_hash TEXT,
  p_token_hash TEXT
)
RETURNS TABLE (
  id UUID,
  label TEXT,
  scopes TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  pairing_id UUID;
  pairing_owner_id UUID;
  pairing_label TEXT;
  pairing_scopes TEXT[];
BEGIN
  IF p_code_hash IS NULL
     OR p_code_hash !~ '^[0-9a-f]{64}$'
     OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'El código de emparejamiento no es válido.';
  END IF;

  SELECT d.id, d.owner_id, d.label, d.scopes
  INTO pairing_id, pairing_owner_id, pairing_label, pairing_scopes
  FROM public.device_pairing_codes AS d
  WHERE d.code_hash = p_code_hash
    AND d.consumed_at IS NULL
    AND d.expires_at > NOW()
  ORDER BY d.created_at DESC, d.id DESC
  LIMIT 1
  FOR UPDATE;

  IF pairing_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'El código de emparejamiento no es válido o ya venció.';
  END IF;

  UPDATE public.device_pairing_codes
  SET consumed_at = NOW()
  WHERE id = pairing_id;

  RETURN QUERY
  INSERT INTO public.device_tokens (owner_id, token_hash, label, scopes)
  VALUES (pairing_owner_id, p_token_hash, pairing_label, pairing_scopes)
  RETURNING
    device_tokens.id,
    device_tokens.label,
    device_tokens.scopes,
    device_tokens.created_at,
    device_tokens.updated_at,
    device_tokens.last_used_at,
    device_tokens.revoked_at,
    device_tokens.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_device_pairing_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_device_pairing_code(TEXT, TEXT) TO project_admin;

CREATE OR REPLACE FUNCTION public.setup_koreader_habit_links(
  p_device_token_id UUID,
  p_timezone TEXT,
  p_links JSONB
)
RETURNS SETOF public.koreader_habit_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_owner_id UUID := auth.uid();
  item JSONB;
  created_habit_id UUID;
  habit_row public.habits%ROWTYPE;
  link_row public.koreader_habit_links%ROWTYPE;
  schedule_value JSONB := '{"unit":"day","interval":1,"weekdays":[],"dayOfMonth":null,"anchorDate":null}'::JSONB;
BEGIN
  IF request_owner_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Se requiere una sesión autenticada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.device_tokens
    WHERE id = p_device_token_id
      AND owner_id = request_owner_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
      AND 'write:habit_logs' = ANY(scopes)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El dispositivo no está habilitado para sincronizar hábitos.';
  END IF;

  IF p_timezone IS NULL OR length(btrim(p_timezone)) = 0
     OR jsonb_typeof(p_links) <> 'array'
     OR jsonb_array_length(p_links) < 1
     OR jsonb_array_length(p_links) > 4 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La configuración de estadísticas no es válida.';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_links)
  LOOP
    IF jsonb_typeof(item) <> 'object'
       OR item->>'metric_key' IS NULL
       OR item->>'metric_key' NOT IN (
         'reading_pages',
         'reading_minutes',
         'books_completed',
         'anki_cards_reviewed'
       )
       OR item->>'source_unit' IS NULL
       OR item->>'source_unit' NOT IN ('pages', 'minutes', 'books', 'cards')
       OR COALESCE(length(btrim(item->>'target_unit')), 0) NOT BETWEEN 1 AND 80
       OR (
         item->>'metric_key' = 'reading_pages'
         AND item->>'source_unit' <> 'pages'
       )
       OR (
         item->>'metric_key' = 'reading_minutes'
         AND item->>'source_unit' <> 'minutes'
       )
       OR (
         item->>'metric_key' = 'books_completed'
         AND item->>'source_unit' <> 'books'
       )
       OR (
         item->>'metric_key' = 'anki_cards_reviewed'
         AND item->>'source_unit' <> 'cards'
       )
       OR (
         NULLIF(item->>'habit_id', '') IS NOT NULL
         AND NULLIF(item->>'habit_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La configuración de estadísticas no es válida.';
    END IF;

    created_habit_id := NULLIF(item->>'habit_id', '')::UUID;

    IF created_habit_id IS NULL THEN
      IF COALESCE(length(btrim(item->>'name')), 0) = 0
         OR item->>'goal_value' IS NULL
         OR (item->>'goal_value')::NUMERIC <= 0
         OR item->>'start_date' IS NULL
         OR item->>'start_date' !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La meta del hábito es obligatoria.';
      END IF;

      INSERT INTO public.habits (
        owner_id, name, description, tracking_type, unit, goal_value,
        evaluation_mode, quota_period, miss_policy, schedule, start_date,
        lifecycle_status, stats_enabled, note_policy, calendar_enabled
      )
      VALUES (
        request_owner_id,
        btrim(item->>'name'),
        NULLIF(btrim(item->>'description'), ''),
        CASE WHEN item->>'metric_key' = 'reading_minutes' THEN 'duration' ELSE 'count' END,
        btrim(item->>'target_unit'),
        (item->>'goal_value')::NUMERIC,
        'scheduled_occurrence', NULL, 'mark_missed', schedule_value,
        (item->>'start_date')::DATE, 'active', TRUE, 'none', FALSE
      )
      RETURNING id INTO created_habit_id;

      INSERT INTO public.habit_schedule_versions (
        owner_id, habit_id, schedule, evaluation_mode, goal_value,
        quota_period, miss_policy, effective_from
      )
      VALUES (
        request_owner_id, created_habit_id, schedule_value,
        'scheduled_occurrence', (item->>'goal_value')::NUMERIC,
        NULL, 'mark_missed', (item->>'start_date')::DATE
      );
    END IF;

    SELECT * INTO habit_row
    FROM public.habits
    WHERE id = created_habit_id AND owner_id = request_owner_id;

    IF NOT FOUND OR habit_row.tracking_type = 'boolean' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'El hábito no admite una métrica cuantitativa.';
    END IF;

    INSERT INTO public.koreader_habit_links (
      owner_id, habit_id, device_token_id, metric_key, source_unit,
      target_unit, conversion_factor, timezone, auto_created
    )
    VALUES (
      request_owner_id,
      created_habit_id,
      p_device_token_id,
      item->>'metric_key',
      item->>'source_unit',
      btrim(item->>'target_unit'),
      COALESCE((item->>'conversion_factor')::NUMERIC, 1),
      btrim(p_timezone),
      NULLIF(item->>'habit_id', '') IS NULL
    )
    RETURNING * INTO link_row;

    RETURN NEXT link_row;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.setup_koreader_habit_links(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.setup_koreader_habit_links(UUID, TEXT, JSONB) TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
