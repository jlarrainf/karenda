package app.karenda.android;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class PhoneCalendarEventPlan {
    static final class Result {
        final Map<String, Long> retainedRows;
        final Set<String> rowsToInsert;
        final Set<Long> rowsToDelete;

        Result(Map<String, Long> retainedRows, Set<String> rowsToInsert, Set<Long> rowsToDelete) {
            this.retainedRows = Collections.unmodifiableMap(retainedRows);
            this.rowsToInsert = Collections.unmodifiableSet(rowsToInsert);
            this.rowsToDelete = Collections.unmodifiableSet(rowsToDelete);
        }
    }

    private PhoneCalendarEventPlan() {}

    static Result create(Collection<String> desiredEventIds, Map<String, List<Long>> existingRows) {
        Set<String> desired = new LinkedHashSet<>(desiredEventIds);
        Set<String> rowsToInsert = new LinkedHashSet<>(desired);
        Map<String, Long> retainedRows = new LinkedHashMap<>();
        Set<Long> rowsToDelete = new LinkedHashSet<>();

        for (Map.Entry<String, List<Long>> entry : existingRows.entrySet()) {
            List<Long> rowIds = entry.getValue();
            if (!desired.contains(entry.getKey()) || rowIds.isEmpty()) {
                rowsToDelete.addAll(rowIds);
                continue;
            }

            retainedRows.put(entry.getKey(), rowIds.get(0));
            rowsToInsert.remove(entry.getKey());
            for (int index = 1; index < rowIds.size(); index++) {
                rowsToDelete.add(rowIds.get(index));
            }
        }

        return new Result(retainedRows, rowsToInsert, rowsToDelete);
    }
}
