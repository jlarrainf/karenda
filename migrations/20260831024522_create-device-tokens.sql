CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  label TEXT NOT NULL DEFAULT 'Kindle'
    CHECK (length(btrim(label)) BETWEEN 1 AND 120),
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:snapshot']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  CONSTRAINT device_tokens_scopes_check CHECK (
    cardinality(scopes) > 0
    AND 'read:snapshot' = ANY(scopes)
    AND scopes <@ ARRAY['read:snapshot', 'write:events']::TEXT[]
  )
);

CREATE INDEX device_tokens_owner_id_idx
  ON public.device_tokens (owner_id);

CREATE INDEX device_tokens_owner_active_idx
  ON public.device_tokens (owner_id, revoked_at, expires_at);

CREATE OR REPLACE FUNCTION public.rotate_device_token(
  p_token_id UUID,
  p_token_hash TEXT,
  p_label TEXT,
  p_scopes TEXT[]
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
  request_owner_id UUID := auth.uid();
BEGIN
  IF request_owner_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Se requiere una sesión autenticada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.device_tokens
    WHERE device_tokens.id = p_token_id
      AND device_tokens.owner_id = request_owner_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'No se encontró el dispositivo.';
  END IF;

  UPDATE public.device_tokens
  SET revoked_at = COALESCE(revoked_at, NOW())
  WHERE device_tokens.id = p_token_id
    AND device_tokens.owner_id = request_owner_id;

  RETURN QUERY
  INSERT INTO public.device_tokens (owner_id, token_hash, label, scopes)
  VALUES (request_owner_id, p_token_hash, p_label, p_scopes)
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

CREATE TRIGGER device_tokens_set_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER device_tokens_prevent_owner_change
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_change();

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.device_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.device_tokens FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.rotate_device_token(UUID, TEXT, TEXT, TEXT[])
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_device_token(UUID, TEXT, TEXT, TEXT[])
TO authenticated;
