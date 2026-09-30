ALTER TABLE public.events
  ADD COLUMN late_submission_days INTEGER,
  ADD COLUMN late_submission_penalty_description TEXT;

ALTER TABLE public.events
  ADD CONSTRAINT events_late_submission_days_check
  CHECK (
    late_submission_days IS NULL
    OR (kind = 'academic' AND late_submission_days > 0)
  ),
  ADD CONSTRAINT events_late_submission_penalty_check
  CHECK (
    late_submission_penalty_description IS NULL
    OR (
      late_submission_days IS NOT NULL
      AND char_length(late_submission_penalty_description) <= 1000
      AND btrim(late_submission_penalty_description) <> ''
    )
  );
