CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  description TEXT,
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE RESTRICT,
  personal_group_id UUID REFERENCES public.personal_groups(id) ON DELETE RESTRICT,
  tracking_type TEXT NOT NULL CHECK (tracking_type IN ('boolean', 'count', 'duration')),
  unit TEXT,
  goal_value NUMERIC NOT NULL CHECK (goal_value >= 0),
  evaluation_mode TEXT NOT NULL CHECK (evaluation_mode IN ('scheduled_occurrence', 'period_quota')),
  quota_period TEXT CHECK (quota_period IS NULL OR quota_period IN ('day', 'week', 'month')),
  miss_policy TEXT NOT NULL CHECK (miss_policy IN ('mark_missed', 'keep_pending')),
  schedule JSONB NOT NULL CHECK (jsonb_typeof(schedule) = 'object'),
  start_date DATE NOT NULL,
  end_date DATE,
  lifecycle_status TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'paused', 'archived')),
  stats_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  note_policy TEXT NOT NULL DEFAULT 'none' CHECK (note_policy IN ('none', 'general', 'daily', 'both')),
  calendar_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  calendar_schedule JSONB CHECK (calendar_schedule IS NULL OR jsonb_typeof(calendar_schedule) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT habits_owner_identity_unique UNIQUE (id, owner_id),
  CONSTRAINT habits_relations_check CHECK (NOT (subject_id IS NOT NULL AND personal_group_id IS NOT NULL)),
  CONSTRAINT habits_dates_check CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT habits_measurement_check CHECK (
    (tracking_type = 'boolean' AND unit IS NULL AND goal_value = 1)
    OR (tracking_type IN ('count', 'duration') AND length(btrim(unit)) > 0 AND goal_value > 0)
  ),
  CONSTRAINT habits_quota_check CHECK (
    (evaluation_mode = 'period_quota' AND quota_period IS NOT NULL)
    OR (evaluation_mode = 'scheduled_occurrence' AND quota_period IS NULL)
  )
);

CREATE TABLE public.habit_schedule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  habit_id UUID NOT NULL,
  schedule JSONB NOT NULL CHECK (jsonb_typeof(schedule) = 'object'),
  evaluation_mode TEXT NOT NULL CHECK (evaluation_mode IN ('scheduled_occurrence', 'period_quota')),
  goal_value NUMERIC NOT NULL CHECK (goal_value > 0),
  quota_period TEXT CHECK (quota_period IS NULL OR quota_period IN ('day', 'week', 'month')),
  miss_policy TEXT NOT NULL CHECK (miss_policy IN ('mark_missed', 'keep_pending')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT habit_schedule_versions_dates_check CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  ),
  CONSTRAINT habit_schedule_versions_quota_check CHECK (
    (evaluation_mode = 'period_quota' AND quota_period IS NOT NULL)
    OR (evaluation_mode = 'scheduled_occurrence' AND quota_period IS NULL)
  ),
  CONSTRAINT habit_schedule_versions_habit_fk
    FOREIGN KEY (habit_id, owner_id)
    REFERENCES public.habits (id, owner_id)
    ON DELETE CASCADE
);

CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  habit_id UUID NOT NULL,
  local_date DATE NOT NULL,
  value NUMERIC NOT NULL CHECK (value >= 0),
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'skipped')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'koreader')),
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT habit_logs_habit_fk
    FOREIGN KEY (habit_id, owner_id)
    REFERENCES public.habits (id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT habit_logs_source_external_check CHECK (
    source = 'manual' OR external_id IS NOT NULL
  )
);

CREATE TABLE public.habit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  habit_id UUID NOT NULL,
  entry_date DATE,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  content_markdown TEXT NOT NULL CHECK (length(btrim(content_markdown)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT habit_notes_habit_fk
    FOREIGN KEY (habit_id, owner_id)
    REFERENCES public.habits (id, owner_id)
    ON DELETE CASCADE
);

CREATE TABLE public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT,
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE RESTRICT,
  personal_group_id UUID REFERENCES public.personal_groups(id) ON DELETE RESTRICT,
  schedule JSONB NOT NULL CHECK (jsonb_typeof(schedule) = 'object'),
  start_date DATE NOT NULL,
  end_date DATE,
  next_due_date DATE NOT NULL,
  due_time TIME,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  calendar_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recurring_tasks_owner_identity_unique UNIQUE (id, owner_id),
  CONSTRAINT recurring_tasks_relations_check CHECK (NOT (subject_id IS NOT NULL AND personal_group_id IS NOT NULL)),
  CONSTRAINT recurring_tasks_dates_check CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT recurring_tasks_next_date_check CHECK (next_due_date >= start_date)
);

CREATE TABLE public.recurring_task_schedule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  recurring_task_id UUID NOT NULL,
  schedule JSONB NOT NULL CHECK (jsonb_typeof(schedule) = 'object'),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recurring_task_schedule_versions_dates_check CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  ),
  CONSTRAINT recurring_task_schedule_versions_task_fk
    FOREIGN KEY (recurring_task_id, owner_id)
    REFERENCES public.recurring_tasks (id, owner_id)
    ON DELETE CASCADE
);

CREATE TABLE public.recurring_task_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  recurring_task_id UUID NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'rescheduled')),
  completed_at TIMESTAMPTZ,
  rescheduled_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recurring_task_occurrences_task_fk
    FOREIGN KEY (recurring_task_id, owner_id)
    REFERENCES public.recurring_tasks (id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT recurring_task_occurrences_status_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND rescheduled_to IS NULL)
    OR (status = 'rescheduled' AND completed_at IS NULL AND rescheduled_to IS NOT NULL)
  ),
  CONSTRAINT recurring_task_occurrences_unique UNIQUE (recurring_task_id, due_date)
);

CREATE INDEX habits_owner_status_idx ON public.habits (owner_id, lifecycle_status);
CREATE INDEX habits_owner_dates_idx ON public.habits (owner_id, start_date, end_date);
CREATE INDEX habits_owner_subject_idx ON public.habits (owner_id, subject_id);
CREATE INDEX habits_owner_group_idx ON public.habits (owner_id, personal_group_id);
CREATE INDEX habit_schedule_versions_lookup_idx
  ON public.habit_schedule_versions (owner_id, habit_id, effective_from);
CREATE INDEX habit_logs_lookup_idx
  ON public.habit_logs (owner_id, habit_id, local_date);
CREATE UNIQUE INDEX habit_logs_one_source_per_date_idx
  ON public.habit_logs (habit_id, local_date, source);
CREATE UNIQUE INDEX habit_logs_external_id_idx
  ON public.habit_logs (owner_id, source, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX habit_notes_lookup_idx
  ON public.habit_notes (owner_id, habit_id, entry_date);
CREATE INDEX recurring_tasks_owner_status_idx
  ON public.recurring_tasks (owner_id, status, next_due_date);
CREATE INDEX recurring_tasks_owner_subject_idx
  ON public.recurring_tasks (owner_id, subject_id);
CREATE INDEX recurring_tasks_owner_group_idx
  ON public.recurring_tasks (owner_id, personal_group_id);
CREATE INDEX recurring_task_schedule_versions_lookup_idx
  ON public.recurring_task_schedule_versions (owner_id, recurring_task_id, effective_from);
CREATE INDEX recurring_task_occurrences_lookup_idx
  ON public.recurring_task_occurrences (owner_id, recurring_task_id, due_date);

CREATE OR REPLACE FUNCTION public.validate_habit_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.subject_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.subjects
       WHERE id = NEW.subject_id AND owner_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'La asignatura del hábito no existe o no pertenece a la cuenta.';
  END IF;

  IF NEW.personal_group_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.personal_groups
       WHERE id = NEW.personal_group_id AND owner_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'El grupo del hábito no existe o no pertenece a la cuenta.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_recurring_task_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.subject_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.subjects
       WHERE id = NEW.subject_id AND owner_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'La asignatura de la tarea no existe o no pertenece a la cuenta.';
  END IF;

  IF NEW.personal_group_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.personal_groups
       WHERE id = NEW.personal_group_id AND owner_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'El grupo de la tarea no existe o no pertenece a la cuenta.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER habits_set_updated_at
BEFORE UPDATE ON public.habits
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER habit_schedule_versions_set_updated_at
BEFORE UPDATE ON public.habit_schedule_versions
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER habit_logs_set_updated_at
BEFORE UPDATE ON public.habit_logs
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER habit_notes_set_updated_at
BEFORE UPDATE ON public.habit_notes
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER recurring_tasks_set_updated_at
BEFORE UPDATE ON public.recurring_tasks
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER habits_prevent_owner_change
BEFORE UPDATE ON public.habits
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER habit_schedule_versions_prevent_owner_change
BEFORE UPDATE ON public.habit_schedule_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER habit_logs_prevent_owner_change
BEFORE UPDATE ON public.habit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER habit_notes_prevent_owner_change
BEFORE UPDATE ON public.habit_notes
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER recurring_tasks_prevent_owner_change
BEFORE UPDATE ON public.recurring_tasks
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER recurring_task_schedule_versions_set_updated_at
BEFORE UPDATE ON public.recurring_task_schedule_versions
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER recurring_task_schedule_versions_prevent_owner_change
BEFORE UPDATE ON public.recurring_task_schedule_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER recurring_task_occurrences_prevent_owner_change
BEFORE UPDATE ON public.recurring_task_occurrences
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER habits_validate_references
BEFORE INSERT OR UPDATE OF owner_id, subject_id, personal_group_id
ON public.habits
FOR EACH ROW EXECUTE FUNCTION public.validate_habit_references();

CREATE TRIGGER recurring_tasks_validate_references
BEFORE INSERT OR UPDATE OF owner_id, subject_id, personal_group_id
ON public.recurring_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_task_references();

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_task_occurrences ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
REVOKE ALL ON TABLE
  public.habits,
  public.habit_schedule_versions,
  public.habit_logs,
  public.habit_notes,
  public.recurring_tasks,
  public.recurring_task_schedule_versions,
  public.recurring_task_occurrences
FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.habits,
  public.habit_schedule_versions,
  public.habit_logs,
  public.habit_notes,
  public.recurring_tasks,
  public.recurring_task_schedule_versions,
  public.recurring_task_occurrences
TO authenticated;

CREATE POLICY habits_select_own ON public.habits
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY habits_insert_own ON public.habits
FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY habits_update_own ON public.habits
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY habits_delete_own ON public.habits
FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY habit_schedule_versions_select_own ON public.habit_schedule_versions
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_schedule_versions_insert_own ON public.habit_schedule_versions
FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_schedule_versions_update_own ON public.habit_schedule_versions
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_schedule_versions_delete_own ON public.habit_schedule_versions
FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY habit_logs_select_own ON public.habit_logs
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_logs_insert_own ON public.habit_logs
FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_logs_update_own ON public.habit_logs
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_logs_delete_own ON public.habit_logs
FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY habit_notes_select_own ON public.habit_notes
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_notes_insert_own ON public.habit_notes
FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_notes_update_own ON public.habit_notes
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY habit_notes_delete_own ON public.habit_notes
FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY recurring_tasks_select_own ON public.recurring_tasks
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_tasks_insert_own ON public.recurring_tasks
FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_tasks_update_own ON public.recurring_tasks
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_tasks_delete_own ON public.recurring_tasks
FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY recurring_task_schedule_versions_select_own
ON public.recurring_task_schedule_versions
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_task_schedule_versions_insert_own
ON public.recurring_task_schedule_versions
FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_task_schedule_versions_update_own
ON public.recurring_task_schedule_versions
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_task_schedule_versions_delete_own
ON public.recurring_task_schedule_versions
FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY recurring_task_occurrences_select_own ON public.recurring_task_occurrences
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_task_occurrences_insert_own ON public.recurring_task_occurrences
FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_task_occurrences_update_own ON public.recurring_task_occurrences
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY recurring_task_occurrences_delete_own ON public.recurring_task_occurrences
FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));
