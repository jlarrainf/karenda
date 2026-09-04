ALTER TABLE public.canvas_course_links
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS canvas_course_links_owner_active_idx
  ON public.canvas_course_links (owner_id, active, canvas_name);

CREATE OR REPLACE FUNCTION public.canvas_course_links_activate_on_subject_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subject_id IS DISTINCT FROM OLD.subject_id THEN
    NEW.active := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS canvas_course_links_activate_on_subject_change
ON public.canvas_course_links;

CREATE TRIGGER canvas_course_links_activate_on_subject_change
BEFORE UPDATE OF subject_id ON public.canvas_course_links
FOR EACH ROW EXECUTE FUNCTION public.canvas_course_links_activate_on_subject_change();

CREATE OR REPLACE FUNCTION public.unlink_canvas_course_link(p_course_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  request_owner_id UUID := auth.uid();
  link_record public.canvas_course_links%ROWTYPE;
BEGIN
  IF request_owner_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Se requiere una sesión autenticada.';
  END IF;

  SELECT * INTO link_record
  FROM public.canvas_course_links
  WHERE id = p_course_link_id
    AND owner_id = request_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'No se encontró el vínculo de Canvas.';
  END IF;

  UPDATE public.canvas_course_links
  SET active = FALSE
  WHERE id = link_record.id;

  RETURN jsonb_build_object(
    'course_link_id', link_record.id,
    'status', 'unlinked',
    'canvas_course_id', link_record.canvas_course_id,
    'subject_id', link_record.subject_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_canvas_course_link(UUID)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_canvas_course_link(UUID)
TO authenticated;
