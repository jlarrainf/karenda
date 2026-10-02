package app.karenda.android;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.Test;

public class PhoneCalendarEventPlanTest {
    @Test
    public void retainsExistingRowsAndMarksNewEventsForInsertion() {
        Map<String, java.util.List<Long>> existingRows = new LinkedHashMap<>();
        existingRows.put("event-existing", Collections.singletonList(10L));

        PhoneCalendarEventPlan.Result result = PhoneCalendarEventPlan.create(
            Arrays.asList("event-existing", "event-new"),
            existingRows
        );

        assertEquals(Long.valueOf(10L), result.retainedRows.get("event-existing"));
        assertEquals(Collections.singleton("event-new"), result.rowsToInsert);
        assertEquals(Collections.emptySet(), result.rowsToDelete);
    }

    @Test
    public void retainsOneRowAndDeletesDuplicateAndObsoleteManagedRows() {
        Map<String, java.util.List<Long>> existingRows = new LinkedHashMap<>();
        existingRows.put("event-current", Arrays.asList(10L, 11L));
        existingRows.put("event-deleted", Collections.singletonList(20L));

        PhoneCalendarEventPlan.Result result = PhoneCalendarEventPlan.create(
            Collections.singletonList("event-current"),
            existingRows
        );

        assertEquals(Collections.singletonMap("event-current", 10L), result.retainedRows);
        assertEquals(Collections.emptySet(), result.rowsToInsert);
        assertEquals(new java.util.LinkedHashSet<>(Arrays.asList(11L, 20L)), result.rowsToDelete);
    }
}
