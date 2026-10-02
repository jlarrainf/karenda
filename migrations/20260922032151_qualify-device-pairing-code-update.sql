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
  WHERE device_pairing_codes.id = pairing_id;

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
