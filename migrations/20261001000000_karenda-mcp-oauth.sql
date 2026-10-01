CREATE TABLE public.mcp_oauth_clients (
  client_id TEXT PRIMARY KEY CHECK (length(client_id) BETWEEN 1 AND 255),
  client_name TEXT NOT NULL CHECK (length(btrim(client_name)) BETWEEN 1 AND 120),
  redirect_uris TEXT[] NOT NULL
    CHECK (cardinality(redirect_uris) BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.mcp_authorization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL
    REFERENCES public.mcp_oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL CHECK (length(redirect_uri) BETWEEN 1 AND 2048),
  requested_scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  state TEXT NOT NULL CHECK (length(state) BETWEEN 1 AND 512),
  code_challenge TEXT NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  resource_uri TEXT NOT NULL CHECK (length(resource_uri) BETWEEN 1 AND 2048),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  CONSTRAINT mcp_authorization_requests_scopes_check CHECK (
    requested_scopes <@ ARRAY[
      'profile:read',
      'events:read', 'events:write', 'events:delete',
      'notes:read', 'notes:write', 'notes:delete',
      'habits:read', 'habits:write', 'habits:delete',
      'recurring:read', 'recurring:write',
      'catalogs:read', 'catalogs:write', 'catalogs:delete',
      'canvas:read', 'canvas:sync', 'canvas:review',
      'ai:draft'
    ]::TEXT[]
  ),
  CONSTRAINT mcp_authorization_requests_expiry_check CHECK (expires_at > created_at)
);

CREATE TABLE public.mcp_oauth_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL
    REFERENCES public.mcp_oauth_clients(client_id) ON DELETE RESTRICT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  insforge_access_token_ciphertext TEXT NOT NULL
    CHECK (length(insforge_access_token_ciphertext) BETWEEN 24 AND 8192),
  insforge_access_token_iv TEXT NOT NULL
    CHECK (length(insforge_access_token_iv) BETWEEN 16 AND 64),
  insforge_access_expires_at TIMESTAMPTZ NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT mcp_oauth_grants_id_client_unique UNIQUE (id, client_id),
  CONSTRAINT mcp_oauth_grants_insforge_expiry_check
    CHECK (insforge_access_expires_at > granted_at),
  CONSTRAINT mcp_oauth_grants_scopes_check CHECK (
    scopes <@ ARRAY[
      'profile:read',
      'events:read', 'events:write', 'events:delete',
      'notes:read', 'notes:write', 'notes:delete',
      'habits:read', 'habits:write', 'habits:delete',
      'recurring:read', 'recurring:write',
      'catalogs:read', 'catalogs:write', 'catalogs:delete',
      'canvas:read', 'canvas:sync', 'canvas:review',
      'ai:draft'
    ]::TEXT[]
  )
);

CREATE TABLE public.mcp_authorization_codes (
  code_hash TEXT PRIMARY KEY CHECK (code_hash ~ '^[A-Za-z0-9_-]{43}$'),
  grant_id UUID NOT NULL
    REFERENCES public.mcp_oauth_grants(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL
    REFERENCES public.mcp_oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL CHECK (length(redirect_uri) BETWEEN 1 AND 2048),
  code_challenge TEXT NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  resource_uri TEXT NOT NULL CHECK (length(resource_uri) BETWEEN 1 AND 2048),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  CONSTRAINT mcp_authorization_codes_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT mcp_authorization_codes_client_grant_fk
    FOREIGN KEY (grant_id, client_id)
    REFERENCES public.mcp_oauth_grants(id, client_id) ON DELETE CASCADE
);

CREATE TABLE public.mcp_access_tokens (
  token_hash TEXT PRIMARY KEY CHECK (token_hash ~ '^[A-Za-z0-9_-]{43}$'),
  grant_id UUID NOT NULL
    REFERENCES public.mcp_oauth_grants(id) ON DELETE CASCADE,
  resource_uri TEXT NOT NULL CHECK (length(resource_uri) BETWEEN 1 AND 2048),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT mcp_access_tokens_expiry_check CHECK (expires_at > created_at)
);

CREATE TABLE public.mcp_refresh_tokens (
  token_hash TEXT PRIMARY KEY CHECK (token_hash ~ '^[A-Za-z0-9_-]{43}$'),
  grant_id UUID NOT NULL
    REFERENCES public.mcp_oauth_grants(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT mcp_refresh_tokens_expiry_check CHECK (expires_at > created_at)
);

CREATE TABLE public.mcp_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID REFERENCES public.mcp_oauth_grants(id) ON DELETE SET NULL,
  operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 80),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'error')),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 600000),
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mcp_oauth_clients_created_idx
  ON public.mcp_oauth_clients(created_at DESC);
CREATE INDEX mcp_authorization_requests_expiry_idx
  ON public.mcp_authorization_requests(expires_at);
CREATE INDEX mcp_authorization_requests_owner_idx
  ON public.mcp_authorization_requests(owner_id, created_at DESC)
  WHERE owner_id IS NOT NULL;
CREATE INDEX mcp_oauth_grants_owner_idx
  ON public.mcp_oauth_grants(owner_id, granted_at DESC);
CREATE INDEX mcp_oauth_grants_active_idx
  ON public.mcp_oauth_grants(owner_id, last_used_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX mcp_authorization_codes_expiry_idx
  ON public.mcp_authorization_codes(expires_at);
CREATE INDEX mcp_access_tokens_grant_expiry_idx
  ON public.mcp_access_tokens(grant_id, expires_at);
CREATE INDEX mcp_refresh_tokens_grant_idx
  ON public.mcp_refresh_tokens(grant_id, created_at DESC);
CREATE INDEX mcp_audit_events_created_idx
  ON public.mcp_audit_events(created_at DESC);
CREATE INDEX mcp_audit_events_grant_idx
  ON public.mcp_audit_events(grant_id, created_at DESC);

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_authorization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_audit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mcp_oauth_clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_authorization_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_authorization_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_access_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_refresh_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_audit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.mcp_oauth_clients,
  public.mcp_authorization_requests,
  public.mcp_oauth_grants,
  public.mcp_authorization_codes,
  public.mcp_access_tokens,
  public.mcp_refresh_tokens,
  public.mcp_audit_events
FROM PUBLIC, anon, authenticated;
