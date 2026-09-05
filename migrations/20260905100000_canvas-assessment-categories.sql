ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_academic_activity_type_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_academic_activity_type_check CHECK (
    academic_activity_type IS NULL
    OR (
      kind = 'academic'
      AND academic_activity_type IN (
        'control', 'assignment', 'activity', 'project', 'submission',
        'test', 'exam', 'seminar',
        'graded_discussion', 'quiz', 'oral_assessment', 'other'
      )
    )
  );

ALTER TABLE public.canvas_item_links
  DROP CONSTRAINT IF EXISTS canvas_item_links_academic_activity_type_check;

ALTER TABLE public.canvas_item_links
  ADD CONSTRAINT canvas_item_links_academic_activity_type_check CHECK (
    academic_activity_type IS NULL OR academic_activity_type IN (
      'control', 'assignment', 'activity', 'project', 'submission',
      'test', 'exam', 'seminar',
      'graded_discussion', 'quiz', 'oral_assessment', 'other'
    )
  );

ALTER TABLE public.canvas_review_items
  DROP CONSTRAINT IF EXISTS canvas_review_items_academic_activity_type_check;

ALTER TABLE public.canvas_review_items
  ADD CONSTRAINT canvas_review_items_academic_activity_type_check CHECK (
    academic_activity_type IS NULL OR academic_activity_type IN (
      'control', 'assignment', 'activity', 'project', 'submission',
      'test', 'exam', 'seminar',
      'graded_discussion', 'quiz', 'oral_assessment', 'other'
    )
  );
