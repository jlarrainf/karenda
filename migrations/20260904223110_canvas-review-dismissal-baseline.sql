CREATE OR REPLACE FUNCTION public.capture_ignored_canvas_review_baseline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'pending'
     AND NEW.status = 'ignored'
     AND NEW.canvas_item_type IS NOT NULL
     AND NEW.canvas_item_id IS NOT NULL THEN
    UPDATE public.canvas_item_links AS item_link
    SET source_snapshot = COALESCE(NEW.proposed_data->'remote', NEW.proposed_data),
        applied_event_snapshot = CASE
          WHEN item_link.event_id IS NULL THEN item_link.applied_event_snapshot
          ELSE COALESCE(
            (
              SELECT jsonb_build_object(
                'title', event.title,
                'start_at', event.start_at,
                'end_at', event.end_at,
                'is_all_day', event.is_all_day,
                'status', event.status,
                'location', event.location,
                'description', event.description,
                'academic_activity_type', event.academic_activity_type
              )
              FROM public.events AS event
              WHERE event.id = item_link.event_id
                AND event.owner_id = NEW.owner_id
            ),
            item_link.applied_event_snapshot
          )
        END,
        last_source_hash = COALESCE(NEW.source_hash, item_link.last_source_hash),
        last_seen_at = NOW()
    WHERE item_link.connection_id = NEW.connection_id
      AND item_link.owner_id = NEW.owner_id
      AND item_link.canvas_item_type = NEW.canvas_item_type
      AND item_link.canvas_item_id = NEW.canvas_item_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_ignored_canvas_review_baseline() FROM PUBLIC;

CREATE TRIGGER canvas_review_items_capture_ignored_baseline
AFTER UPDATE OF status ON public.canvas_review_items
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.capture_ignored_canvas_review_baseline();
