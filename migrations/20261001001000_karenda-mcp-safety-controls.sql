CREATE TABLE public.mcp_rate_limit_buckets (
  bucket_key TEXT NOT NULL CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket_key, window_started_at)
);

CREATE TABLE public.mcp_idempotency_receipts (
  key_hash TEXT PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.mcp_oauth_grants(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL CHECK (length(tool_name) BETWEEN 1 AND 120),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT mcp_idempotency_receipts_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT mcp_idempotency_receipts_response_check CHECK (
    (status = 'in_progress' AND response IS NULL)
    OR (status = 'completed' AND response IS NOT NULL)
  )
);

CREATE INDEX mcp_idempotency_receipts_expiry_idx
  ON public.mcp_idempotency_receipts (expires_at);
CREATE INDEX mcp_idempotency_receipts_grant_idx
  ON public.mcp_idempotency_receipts (grant_id, created_at DESC);

ALTER TABLE public.mcp_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_rate_limit_buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_idempotency_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_idempotency_receipts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_rate_limit_buckets, public.mcp_idempotency_receipts
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mcp_consume_rate_limit(
  p_bucket_key TEXT,
  p_window_seconds INTEGER,
  p_limit INTEGER
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_window_started_at TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  IF p_bucket_key IS NULL OR p_bucket_key !~ '^[0-9a-f]{64}$'
     OR p_window_seconds NOT BETWEEN 1 AND 3600
     OR p_limit NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid rate limit parameters.';
  END IF;

  v_window_started_at := to_timestamp(
    floor(extract(epoch FROM NOW()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.mcp_rate_limit_buckets AS bucket (
    bucket_key, window_started_at, request_count, updated_at
  ) VALUES (
    p_bucket_key, v_window_started_at, 1, NOW()
  )
  ON CONFLICT (bucket_key, window_started_at)
  DO UPDATE SET
    request_count = bucket.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_request_count;

  DELETE FROM public.mcp_rate_limit_buckets
  WHERE window_started_at < NOW() - INTERVAL '2 days';

  RETURN QUERY SELECT
    v_request_count <= p_limit,
    greatest(p_limit - v_request_count, 0),
    v_window_started_at + make_interval(secs => p_window_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_claim_idempotency(
  p_key_hash TEXT,
  p_owner_id UUID,
  p_grant_id UUID,
  p_tool_name TEXT,
  p_request_hash TEXT
)
RETURNS TABLE (claim_state TEXT, cached_response JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_receipt public.mcp_idempotency_receipts%ROWTYPE;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$'
     OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR p_owner_id IS NULL OR p_grant_id IS NULL
     OR p_tool_name IS NULL OR length(p_tool_name) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid idempotency parameters.';
  END IF;

  DELETE FROM public.mcp_idempotency_receipts AS expired
  WHERE expired.key_hash = p_key_hash AND expired.expires_at <= NOW();

  INSERT INTO public.mcp_idempotency_receipts (
    key_hash, owner_id, grant_id, tool_name, request_hash,
    status, response, expires_at
  ) VALUES (
    p_key_hash, p_owner_id, p_grant_id, p_tool_name, p_request_hash,
    'in_progress', NULL, NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (key_hash) DO NOTHING;

  IF FOUND THEN
    RETURN QUERY SELECT 'claimed'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  SELECT receipt.* INTO v_receipt
  FROM public.mcp_idempotency_receipts AS receipt
  WHERE receipt.key_hash = p_key_hash
  FOR UPDATE;

  IF NOT FOUND OR v_receipt.owner_id <> p_owner_id
     OR v_receipt.grant_id <> p_grant_id
     OR v_receipt.tool_name <> p_tool_name
     OR v_receipt.request_hash <> p_request_hash THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  IF v_receipt.status = 'completed' THEN
    RETURN QUERY SELECT 'replay'::TEXT, v_receipt.response;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'in_progress'::TEXT, NULL::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_complete_idempotency(
  p_key_hash TEXT,
  p_request_hash TEXT,
  p_response JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$'
     OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR p_response IS NULL OR octet_length(p_response::TEXT) > 65536 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid idempotency response.';
  END IF;

  UPDATE public.mcp_idempotency_receipts
  SET status = 'completed', response = p_response
  WHERE key_hash = p_key_hash
    AND request_hash = p_request_hash
    AND status = 'in_progress'
    AND expires_at > NOW();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_claim_idempotency(TEXT, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_complete_idempotency(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_consume_rate_limit(TEXT, INTEGER, INTEGER) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mcp_claim_idempotency(TEXT, UUID, UUID, TEXT, TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mcp_complete_idempotency(TEXT, TEXT, JSONB) TO project_admin;
