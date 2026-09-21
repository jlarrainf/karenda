ALTER TABLE public.canvas_connections
  ADD COLUMN content_lookback_days INTEGER NOT NULL DEFAULT 30
    CHECK (content_lookback_days BETWEEN 7 AND 365);
