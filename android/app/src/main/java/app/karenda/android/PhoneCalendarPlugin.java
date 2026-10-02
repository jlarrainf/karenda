package app.karenda.android;

import android.Manifest;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Events;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

@CapacitorPlugin(
    name = "PhoneCalendar",
    permissions = {
        @Permission(
            alias = "calendar",
            strings = {
                Manifest.permission.READ_CALENDAR,
                Manifest.permission.WRITE_CALENDAR
            }
        )
    }
)
public class PhoneCalendarPlugin extends Plugin {
    private static final String ACCOUNT_NAME = "Karenda";
    private static final String LOCAL_CALENDAR_PREFIX = "karenda:";
    private static final String DEFAULT_ACADEMIC_COLOR = "#2F625A";
    private static final String DEFAULT_PERSONAL_COLOR = "#7A8780";
    private static final String PREFERENCES_NAME = "phone_calendar_sync";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_LAST_SYNCED_AT = "last_synced_at";
    private static final String KEY_EVENT_COUNT = "event_count";
    private static final String KEY_CALENDAR_COUNT = "calendar_count";

    private static final class CalendarDefinition {
        final String key;
        final String name;
        final String color;

        CalendarDefinition(String key, String name, String color) {
            this.key = key;
            this.name = name;
            this.color = color;
        }

        String providerName() {
            return LOCAL_CALENDAR_PREFIX + key;
        }
    }

    private static final class CalendarRecord {
        final long id;
        final String name;

        CalendarRecord(long id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    private static final class EventData {
        final String id;
        final String calendarKey;
        final String title;
        final String startAt;
        final String endAt;
        final boolean allDay;
        final String location;
        final String description;

        EventData(
            String id,
            String calendarKey,
            String title,
            String startAt,
            String endAt,
            boolean allDay,
            String location,
            String description
        ) {
            this.id = id;
            this.calendarKey = calendarKey;
            this.title = title;
            this.startAt = startAt;
            this.endAt = endAt;
            this.allDay = allDay;
            this.location = location;
            this.description = description;
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void requestCalendarPermission(PluginCall call) {
        if (getPermissionState("calendar") == PermissionState.GRANTED) {
            resolvePermissionState(call);
            return;
        }
        requestPermissionForAlias("calendar", call, "calendarPermissionCallback");
    }

    @PermissionCallback
    private void calendarPermissionCallback(PluginCall call) {
        resolvePermissionState(call);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        if (enabled && getPermissionState("calendar") != PermissionState.GRANTED) {
            call.reject("Permite el acceso al calendario antes de activar la sincronización.", "PERMISSION_DENIED");
            return;
        }

        preferences().edit().putBoolean(KEY_ENABLED, enabled).apply();
        call.resolve();
    }

    @PluginMethod
    public void sync(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            call.reject("Permite el acceso al calendario para sincronizar Karenda.", "PERMISSION_DENIED");
            return;
        }

        try {
            JSArray calendarArray = call.getArray("calendars");
            JSArray eventArray = call.getArray("events");
            if (calendarArray == null || eventArray == null) {
                call.reject("No se recibieron los calendarios y eventos de Karenda.", "INVALID_PAYLOAD");
                return;
            }

            List<CalendarDefinition> definitions = parseCalendars(calendarArray);
            List<EventData> events = parseEvents(eventArray, definitions);
            Map<String, Long> calendarIds = synchronizeCalendars(definitions);
            synchronizeEvents(events, calendarIds, queryManagedCalendarIds());
            cleanObsoleteCalendars(definitions);

            SharedPreferences.Editor editor = preferences().edit();
            editor.putBoolean(KEY_ENABLED, true);
            editor.putString(KEY_LAST_SYNCED_AT, currentUtcTimestamp());
            editor.putInt(KEY_EVENT_COUNT, events.size());
            editor.putInt(KEY_CALENDAR_COUNT, calendarIds.size());
            editor.apply();
            call.resolve(buildStatus());
        } catch (SecurityException error) {
            call.reject("Android no permitió actualizar el calendario del teléfono.", "PERMISSION_DENIED", error);
        } catch (Exception error) {
            call.reject("No se pudo completar la sincronización del calendario del teléfono.", "SYNC_FAILED", error);
        }
    }

    private void resolvePermissionState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("calendar") == PermissionState.GRANTED);
        call.resolve(result);
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES_NAME, android.content.Context.MODE_PRIVATE);
    }

    private JSObject buildStatus() {
        SharedPreferences prefs = preferences();
        JSObject result = new JSObject();
        result.put("enabled", prefs.getBoolean(KEY_ENABLED, false));
        result.put("lastSyncedAt", prefs.getString(KEY_LAST_SYNCED_AT, null));
        result.put("eventCount", prefs.getInt(KEY_EVENT_COUNT, 0));
        result.put("calendarCount", prefs.getInt(KEY_CALENDAR_COUNT, 0));
        return result;
    }

    private List<CalendarDefinition> parseCalendars(JSArray array) throws JSONException {
        List<CalendarDefinition> definitions = new ArrayList<>();
        Set<String> keys = new HashSet<>();
        for (int index = 0; index < array.length(); index++) {
            JSONObject item = array.getJSONObject(index);
            String key = item.optString("key", "").trim();
            String name = item.optString("name", "").trim();
            String color = item.optString("color", "").trim();
            if (!isValidCalendarKey(key) || TextUtils.isEmpty(name) || name.length() > 120) {
                throw new IllegalArgumentException("La categoría del calendario no es válida.");
            }
            if (!keys.add(key)) {
                throw new IllegalArgumentException("La categoría del calendario está repetida.");
            }
            definitions.add(new CalendarDefinition(key, name, color));
        }
        return definitions;
    }

    private List<EventData> parseEvents(JSArray array, List<CalendarDefinition> definitions) throws JSONException {
        Set<String> calendarKeys = new HashSet<>();
        for (CalendarDefinition definition : definitions) calendarKeys.add(definition.key);

        List<EventData> events = new ArrayList<>();
        Set<String> eventIds = new HashSet<>();
        for (int index = 0; index < array.length(); index++) {
            JSONObject item = array.getJSONObject(index);
            String id = item.optString("id", "").trim();
            String calendarKey = item.optString("calendarKey", "").trim();
            String title = item.optString("title", "").trim();
            String startAt = item.optString("startAt", "").trim();
            String endAt = item.isNull("endAt") ? null : item.optString("endAt", "").trim();
            boolean allDay = item.optBoolean("isAllDay", false);
            String location = item.isNull("location") ? null : item.optString("location", "");
            String description = item.isNull("description") ? null : item.optString("description", "");

            if (!isValidEventId(id) || TextUtils.isEmpty(title) || TextUtils.isEmpty(startAt)) {
                throw new IllegalArgumentException("Un evento de Karenda no tiene datos válidos.");
            }
            if (!calendarKeys.contains(calendarKey)) {
                throw new IllegalArgumentException("Un evento no tiene un calendario de destino.");
            }
            if (!eventIds.add(id)) {
                throw new IllegalArgumentException("La lista contiene un evento repetido.");
            }
            events.add(new EventData(id, calendarKey, title, startAt, endAt, allDay, location, description));
        }
        return events;
    }

    private boolean isValidCalendarKey(String key) {
        if (key.length() > 80) return false;
        return key.matches("^(subject:[0-9a-fA-F-]{36}|personal:[0-9a-fA-F-]{36}|academic:unassigned|personal:unassigned)$");
    }

    private boolean isValidEventId(String id) {
        return id.matches("[0-9a-fA-F-]{36}");
    }

    private Map<String, Long> synchronizeCalendars(List<CalendarDefinition> definitions) {
        Map<String, CalendarRecord> existing = queryManagedCalendars();
        Map<String, Long> result = new HashMap<>();
        for (CalendarDefinition definition : definitions) {
            CalendarRecord current = existing.remove(definition.providerName());
            ContentValues values = calendarValues(definition);
            if (current == null) {
                Uri inserted = getContext().getContentResolver().insert(syncAdapterUri(Calendars.CONTENT_URI), values);
                if (inserted == null) throw new IllegalStateException("Android no creó un calendario local.");
                result.put(definition.key, ContentUris.parseId(inserted));
            } else {
                Uri calendarUri = ContentUris.withAppendedId(Calendars.CONTENT_URI, current.id);
                int updated = getContext().getContentResolver().update(syncAdapterUri(calendarUri), values, null, null);
                if (updated != 1) throw new IllegalStateException("Android no pudo actualizar un calendario local.");
                result.put(definition.key, current.id);
            }
        }
        return result;
    }

    private ContentValues calendarValues(CalendarDefinition definition) {
        ContentValues values = new ContentValues();
        values.put(Calendars.ACCOUNT_NAME, ACCOUNT_NAME);
        values.put(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
        values.put(Calendars.NAME, definition.providerName());
        values.put(Calendars.CALENDAR_DISPLAY_NAME, "Karenda · " + definition.name);
        values.put(Calendars.CALENDAR_COLOR, parseColor(definition.color, definition.key.startsWith("subject:") || definition.key.startsWith("academic:")
            ? DEFAULT_ACADEMIC_COLOR
            : DEFAULT_PERSONAL_COLOR));
        values.put(Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CAL_ACCESS_READ);
        values.put(Calendars.OWNER_ACCOUNT, ACCOUNT_NAME);
        values.put(Calendars.SYNC_EVENTS, 1);
        values.put(Calendars.VISIBLE, 1);
        values.put(Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().getID());
        values.put(Calendars.MAX_REMINDERS, 0);
        return values;
    }

    private int parseColor(String color, String fallback) {
        try {
            return Color.parseColor(color);
        } catch (Exception ignored) {
            return Color.parseColor(fallback);
        }
    }

    private Map<String, CalendarRecord> queryManagedCalendars() {
        Map<String, CalendarRecord> result = new HashMap<>();
        String[] projection = { Calendars._ID, Calendars.NAME };
        String selection = Calendars.ACCOUNT_NAME + "=? AND " + Calendars.ACCOUNT_TYPE + "=?";
        String[] selectionArgs = { ACCOUNT_NAME, CalendarContract.ACCOUNT_TYPE_LOCAL };
        try (Cursor cursor = getContext().getContentResolver().query(
            syncAdapterUri(Calendars.CONTENT_URI), projection, selection, selectionArgs, null
        )) {
            if (cursor == null) return result;
            int idIndex = cursor.getColumnIndexOrThrow(Calendars._ID);
            int nameIndex = cursor.getColumnIndexOrThrow(Calendars.NAME);
            while (cursor.moveToNext()) {
                String name = cursor.getString(nameIndex);
                if (name != null && name.startsWith(LOCAL_CALENDAR_PREFIX)) {
                    result.put(name, new CalendarRecord(cursor.getLong(idIndex), name));
                }
            }
        }
        return result;
    }

    private Set<Long> queryManagedCalendarIds() {
        Set<Long> result = new HashSet<>();
        for (CalendarRecord record : queryManagedCalendars().values()) result.add(record.id);
        return result;
    }

    private void synchronizeEvents(
        List<EventData> events,
        Map<String, Long> calendarIds,
        Iterable<Long> managedCalendarIds
    ) throws ParseException {
        Map<String, List<Long>> existing = queryManagedEvents(managedCalendarIds);
        List<String> desiredEventIds = new ArrayList<>();
        for (EventData event : events) desiredEventIds.add(event.id);
        PhoneCalendarEventPlan.Result plan = PhoneCalendarEventPlan.create(desiredEventIds, existing);

        for (EventData event : events) {
            Long calendarId = calendarIds.get(event.calendarKey);
            if (calendarId == null) throw new IllegalStateException("Falta el calendario de una categoría Karenda.");
            ContentValues values = eventValues(event, calendarId);
            Long existingRowId = plan.retainedRows.get(event.id);
            if (existingRowId == null) {
                Uri inserted = getContext().getContentResolver().insert(syncAdapterUri(Events.CONTENT_URI), values);
                if (inserted == null) throw new IllegalStateException("Android no guardó un evento de Karenda.");
            } else {
                Uri eventUri = ContentUris.withAppendedId(Events.CONTENT_URI, existingRowId);
                int updated = getContext().getContentResolver().update(syncAdapterUri(eventUri), values, null, null);
                if (updated != 1) throw new IllegalStateException("Android no pudo actualizar un evento de Karenda.");
            }
        }

        for (Long id : plan.rowsToDelete) {
            Uri eventUri = ContentUris.withAppendedId(Events.CONTENT_URI, id);
            getContext().getContentResolver().delete(syncAdapterUri(eventUri), null, null);
        }
    }

    private ContentValues eventValues(EventData event, long calendarId) throws ParseException {
        long startMillis;
        long endMillis;
        String timeZone;
        if (event.allDay) {
            startMillis = parseAllDayDate(event.startAt);
            endMillis = event.endAt == null || event.endAt.isEmpty()
                ? startMillis + 86_400_000L
                : parseAllDayDate(event.endAt);
            if (endMillis <= startMillis) {
                throw new IllegalArgumentException("La fecha de término debe ser posterior al inicio.");
            }
            timeZone = "UTC";
        } else {
            startMillis = parseTimestamp(event.startAt);
            endMillis = event.endAt == null || event.endAt.isEmpty()
                ? startMillis + 60_000L
                : parseTimestamp(event.endAt);
            if (endMillis <= startMillis) {
                throw new IllegalArgumentException("La hora de término debe ser posterior al inicio.");
            }
            timeZone = TimeZone.getDefault().getID();
        }

        ContentValues values = new ContentValues();
        values.put(Events.CALENDAR_ID, calendarId);
        values.put(Events.SYNC_DATA1, event.id);
        values.put(Events.TITLE, event.title);
        values.put(Events.DTSTART, startMillis);
        values.put(Events.DTEND, endMillis);
        values.put(Events.ALL_DAY, event.allDay ? 1 : 0);
        values.put(Events.EVENT_TIMEZONE, timeZone);
        values.put(Events.EVENT_END_TIMEZONE, timeZone);
        values.put(Events.EVENT_LOCATION, event.location);
        values.put(Events.DESCRIPTION, event.description);
        return values;
    }

    private long parseAllDayDate(String value) throws ParseException {
        String date = value.length() >= 10 ? value.substring(0, 10) : value;
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setLenient(false);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.parse(date).getTime();
    }

    private long parseTimestamp(String value) throws ParseException {
        String normalized = value.trim();
        if (normalized.matches(".*T\\d{2}:\\d{2}:\\d{2}(Z|[+-]\\d{2}:?\\d{2})$")) {
            int zoneStart = Math.max(normalized.lastIndexOf('Z'), normalized.lastIndexOf('+'));
            if (zoneStart < 0) zoneStart = normalized.lastIndexOf('-');
            normalized = normalized.substring(0, zoneStart) + ".000" + normalized.substring(zoneStart);
        } else {
            normalized = normalized.replaceFirst("(\\.\\d{3})\\d+(Z|[+-]\\d{2}:?\\d{2})$", "$1$2");
        }

        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US);
        format.setLenient(false);
        return format.parse(normalized).getTime();
    }

    private Map<String, List<Long>> queryManagedEvents(Iterable<Long> calendarIds) {
        List<String> placeholders = new ArrayList<>();
        List<String> selectionArgs = new ArrayList<>();
        for (Long id : calendarIds) {
            placeholders.add("?");
            selectionArgs.add(String.valueOf(id));
        }
        if (placeholders.isEmpty()) return new HashMap<>();

        String selection = Events.CALENDAR_ID + " IN (" + TextUtils.join(",", placeholders) + ") AND "
            + Events.SYNC_DATA1 + " IS NOT NULL";
        String[] projection = { Events._ID, Events.CALENDAR_ID, Events.SYNC_DATA1 };
        Map<String, List<Long>> result = new HashMap<>();
        try (Cursor cursor = getContext().getContentResolver().query(
            syncAdapterUri(Events.CONTENT_URI), projection, selection,
            selectionArgs.toArray(new String[0]), null
        )) {
            if (cursor == null) return result;
            int idIndex = cursor.getColumnIndexOrThrow(Events._ID);
            int keyIndex = cursor.getColumnIndexOrThrow(Events.SYNC_DATA1);
            while (cursor.moveToNext()) {
                String key = cursor.getString(keyIndex);
                if (TextUtils.isEmpty(key)) continue;
                List<Long> rows = result.get(key);
                if (rows == null) {
                    rows = new ArrayList<>();
                    result.put(key, rows);
                }
                rows.add(cursor.getLong(idIndex));
            }
        }
        return result;
    }

    private void cleanObsoleteCalendars(List<CalendarDefinition> definitions) {
        Set<String> desiredNames = new HashSet<>();
        for (CalendarDefinition definition : definitions) desiredNames.add(definition.providerName());
        for (CalendarRecord record : queryManagedCalendars().values()) {
            if (desiredNames.contains(record.name) || calendarHasAnyEvents(record.id)) continue;
            Uri calendarUri = ContentUris.withAppendedId(Calendars.CONTENT_URI, record.id);
            getContext().getContentResolver().delete(syncAdapterUri(calendarUri), null, null);
        }
    }

    private boolean calendarHasAnyEvents(long calendarId) {
        String[] projection = { Events._ID };
        String selection = Events.CALENDAR_ID + "=?";
        String[] selectionArgs = { String.valueOf(calendarId) };
        try (Cursor cursor = getContext().getContentResolver().query(
            Events.CONTENT_URI, projection, selection, selectionArgs, null
        )) {
            return cursor != null && cursor.moveToFirst();
        }
    }

    private Uri syncAdapterUri(Uri uri) {
        return uri.buildUpon()
            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
            .appendQueryParameter(Calendars.ACCOUNT_NAME, ACCOUNT_NAME)
            .appendQueryParameter(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
            .build();
    }

    private String currentUtcTimestamp() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(Calendar.getInstance(TimeZone.getTimeZone("UTC")).getTime());
    }
}
