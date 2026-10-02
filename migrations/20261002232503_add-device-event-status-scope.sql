ALTER TABLE public.device_tokens
  DROP CONSTRAINT IF EXISTS device_tokens_scopes_check;

ALTER TABLE public.device_tokens
  ADD CONSTRAINT device_tokens_scopes_check CHECK (
    cardinality(scopes) > 0
    AND 'read:snapshot' = ANY(scopes)
    AND scopes <@ ARRAY[
      'read:snapshot',
      'write:events',
      'write:habit_logs',
      'write:event_status'
    ]::TEXT[]
  );
