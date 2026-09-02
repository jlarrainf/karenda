CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  code TEXT NOT NULL CHECK (length(btrim(code)) > 0),
  abbreviation TEXT NOT NULL CHECK (length(btrim(abbreviation)) > 0),
  color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.personal_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('academic', 'personal')),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE RESTRICT,
  personal_group_id UUID REFERENCES public.personal_groups(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  location TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_kind_relations_check CHECK (
    (kind = 'academic' AND subject_id IS NOT NULL AND personal_group_id IS NULL)
    OR (kind = 'personal' AND subject_id IS NULL)
  ),
  CONSTRAINT events_end_after_start_check CHECK (end_at IS NULL OR end_at > start_at)
);

CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('subject', 'personal_group')),
  target_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  content_markdown TEXT NOT NULL CHECK (length(btrim(content_markdown)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX subjects_owner_id_idx ON public.subjects (owner_id);
CREATE INDEX personal_groups_owner_id_idx ON public.personal_groups (owner_id);
CREATE INDEX events_owner_id_idx ON public.events (owner_id);
CREATE INDEX events_owner_start_idx ON public.events (owner_id, start_at);
CREATE INDEX events_owner_kind_status_idx ON public.events (owner_id, kind, status);
CREATE INDEX events_owner_subject_idx ON public.events (owner_id, subject_id);
CREATE INDEX events_owner_personal_group_idx
  ON public.events (owner_id, personal_group_id);
CREATE INDEX notes_owner_id_idx ON public.notes (owner_id);
CREATE INDEX notes_owner_target_idx
  ON public.notes (owner_id, target_type, target_id);

CREATE OR REPLACE FUNCTION public.prevent_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION USING MESSAGE = 'El propietario no puede cambiarse.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_event_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.subject_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.subjects
       WHERE id = NEW.subject_id
         AND owner_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'La asignatura del evento no existe o no pertenece a la cuenta.';
  END IF;

  IF NEW.personal_group_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.personal_groups
       WHERE id = NEW.personal_group_id
         AND owner_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'El grupo personal del evento no existe o no pertenece a la cuenta.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_note_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.target_type = 'subject'
     AND NOT EXISTS (
       SELECT 1
       FROM public.subjects
       WHERE id = NEW.target_id
         AND owner_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'El destino de la nota no existe o no pertenece a la cuenta.';
  END IF;

  IF NEW.target_type = 'personal_group'
     AND NOT EXISTS (
       SELECT 1
       FROM public.personal_groups
       WHERE id = NEW.target_id
         AND owner_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'El destino de la nota no existe o no pertenece a la cuenta.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_subject_delete_with_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notes
    WHERE target_type = 'subject'
      AND target_id = OLD.id
  ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'No se puede eliminar la asignatura porque tiene notas asociadas.';
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_personal_group_delete_with_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notes
    WHERE target_type = 'personal_group'
      AND target_id = OLD.id
  ) THEN
    RAISE EXCEPTION USING MESSAGE =
      'No se puede eliminar el grupo personal porque tiene notas asociadas.';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER subjects_set_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER personal_groups_set_updated_at
BEFORE UPDATE ON public.personal_groups
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER notes_set_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER subjects_prevent_owner_change
BEFORE UPDATE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER personal_groups_prevent_owner_change
BEFORE UPDATE ON public.personal_groups
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER events_prevent_owner_change
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER notes_prevent_owner_change
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_change();

CREATE TRIGGER events_validate_references
BEFORE INSERT OR UPDATE OF owner_id, subject_id, personal_group_id
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.validate_event_references();

CREATE TRIGGER notes_validate_target
BEFORE INSERT OR UPDATE OF owner_id, target_type, target_id
ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.validate_note_target();

CREATE TRIGGER subjects_prevent_delete_with_notes
BEFORE DELETE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.prevent_subject_delete_with_notes();

CREATE TRIGGER personal_groups_prevent_delete_with_notes
BEFORE DELETE ON public.personal_groups
FOR EACH ROW
EXECUTE FUNCTION public.prevent_personal_group_delete_with_notes();

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;

REVOKE ALL ON TABLE public.subjects, public.personal_groups, public.events, public.notes
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.subjects, public.personal_groups, public.events, public.notes
TO authenticated;

CREATE POLICY subjects_select_own
ON public.subjects
FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY subjects_insert_own
ON public.subjects
FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY subjects_update_own
ON public.subjects
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY subjects_delete_own
ON public.subjects
FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY personal_groups_select_own
ON public.personal_groups
FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY personal_groups_insert_own
ON public.personal_groups
FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY personal_groups_update_own
ON public.personal_groups
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY personal_groups_delete_own
ON public.personal_groups
FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY events_select_own
ON public.events
FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY events_insert_own
ON public.events
FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY events_update_own
ON public.events
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY events_delete_own
ON public.events
FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY notes_select_own
ON public.notes
FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()));

CREATE POLICY notes_insert_own
ON public.notes
FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY notes_update_own
ON public.notes
FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY notes_delete_own
ON public.notes
FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));
