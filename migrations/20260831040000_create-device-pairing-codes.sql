CREATE TABLE public.device_pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  label TEXT NOT NULL DEFAULT 'Kindle'
    CHECK (length(btrim(label)) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CONSTRAINT device_pairing_codes_expiry_check CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX device_pairing_codes_active_hash_idx
  ON public.device_pairing_codes (code_hash)
  WHERE consumed_at IS NULL;

CREATE INDEX device_pairing_codes_owner_id_idx
  ON public.device_pairing_codes (owner_id, created_at DESC);

CREATE TABLE public.device_pairing_rate_limits (
  rate_key_hash TEXT PRIMARY KEY CHECK (rate_key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX device_pairing_rate_limits_updated_at_idx
  ON public.device_pairing_rate_limits (updated_at);

CREATE OR REPLACE FUNCTION public.consume_device_pairing_attempt(
  p_rate_key_hash TEXT,
  p_limit INTEGER DEFAULT 12,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  allowed BOOLEAN;
BEGIN
  IF p_rate_key_hash IS NULL
     OR p_rate_key_hash !~ '^[0-9a-f]{64}$'
     OR p_limit < 1
     OR p_window_seconds < 1 THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.device_pairing_rate_limits
  WHERE updated_at < NOW() - INTERVAL '1 day';

  INSERT INTO public.device_pairing_rate_limits (
    rate_key_hash,
    window_started_at,
    attempt_count,
    updated_at
  )
  VALUES (p_rate_key_hash, NOW(), 1, NOW())
  ON CONFLICT (rate_key_hash) DO UPDATE
  SET
    window_started_at = CASE
      WHEN NOW() >= device_pairing_rate_limits.window_started_at
        + (p_window_seconds * INTERVAL '1 second')
        THEN NOW()
      ELSE device_pairing_rate_limits.window_started_at
    END,
    attempt_count = CASE
      WHEN NOW() >= device_pairing_rate_limits.window_started_at
        + (p_window_seconds * INTERVAL '1 second')
        THEN 1
      ELSE device_pairing_rate_limits.attempt_count + 1
    END,
    updated_at = NOW()
  RETURNING attempt_count <= p_limit INTO allowed;

  RETURN COALESCE(allowed, FALSE);
END;
$$;

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
BEGIN
  IF p_code_hash IS NULL
     OR p_code_hash !~ '^[0-9a-f]{64}$'
     OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'El código de emparejamiento no es válido.';
  END IF;

  SELECT device_pairing_codes.id,
         device_pairing_codes.owner_id,
         device_pairing_codes.label
  INTO pairing_id, pairing_owner_id, pairing_label
  FROM public.device_pairing_codes
  WHERE device_pairing_codes.code_hash = p_code_hash
    AND device_pairing_codes.consumed_at IS NULL
    AND device_pairing_codes.expires_at > NOW()
  ORDER BY device_pairing_codes.created_at DESC, device_pairing_codes.id DESC
  LIMIT 1
  FOR UPDATE;

  IF pairing_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'El código de emparejamiento no es válido o ya venció.';
  END IF;

  UPDATE public.device_pairing_codes
  SET consumed_at = NOW()
  WHERE device_pairing_codes.id = pairing_id;

  RETURN QUERY
  INSERT INTO public.device_tokens (owner_id, token_hash, label, scopes)
  VALUES (
    pairing_owner_id,
    p_token_hash,
    pairing_label,
    ARRAY['read:snapshot']::TEXT[]
  )
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

ALTER TABLE public.device_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_pairing_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.device_pairing_codes FROM PUBLIC;
REVOKE ALL ON TABLE public.device_pairing_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.device_pairing_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.device_pairing_rate_limits FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.consume_device_pairing_attempt(TEXT, INTEGER, INTEGER)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_device_pairing_attempt(TEXT, INTEGER, INTEGER)
TO project_admin;

REVOKE ALL ON FUNCTION public.redeem_device_pairing_code(TEXT, TEXT)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_device_pairing_code(TEXT, TEXT)
TO project_admin;
