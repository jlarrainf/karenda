ALTER TABLE public.mcp_authorization_requests
  DROP CONSTRAINT mcp_authorization_requests_scopes_check;
ALTER TABLE public.mcp_authorization_requests
  ADD CONSTRAINT mcp_authorization_requests_scopes_check CHECK (
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
  );

ALTER TABLE public.mcp_oauth_grants
  DROP CONSTRAINT mcp_oauth_grants_scopes_check;
ALTER TABLE public.mcp_oauth_grants
  ADD CONSTRAINT mcp_oauth_grants_scopes_check CHECK (
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
  );
