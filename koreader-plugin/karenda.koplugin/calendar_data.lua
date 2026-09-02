local DateUtils = require("date_utils")

local CalendarData = {}

local MONTHS = {
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
}

local WEEKDAYS_SHORT = {
    "Dom",
    "Lun",
    "Mar",
    "Mié",
    "Jue",
    "Vie",
    "Sáb",
}

local WEEKDAYS_FULL = {
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
}

local MODE_LABELS = {
    month = "Mes",
    week = "Semana",
    agenda = "Agenda",
    day = "Día",
}

local function dateFromValue(value)
    if type(value) ~= "string" then
        return nil
    end
    return value:match("^(%d%d%d%d%-%d%d%-%d%d)")
end

local function monthStart(value)
    local parts = DateUtils.parseDateKey(value)
    if not parts then
        return nil
    end
    parts.day = 1
    return DateUtils.formatDateKey(parts)
end

local function shiftMonth(value, offset)
    local parts = DateUtils.parseDateKey(value)
    if not parts or type(offset) ~= "number" or offset % 1 ~= 0 then
        return nil
    end

    local month_index = parts.year * 12 + parts.month - 1 + offset
    local year = math.floor(month_index / 12)
    local month = month_index % 12 + 1
    return string.format("%04d-%02d-01", year, month)
end

local function weekdayNumber(value)
    local parts = DateUtils.parseDateKey(value)
    if not parts then
        return nil
    end

    local timestamp = os.time{
        year = parts.year,
        month = parts.month,
        day = parts.day,
        hour = 12,
        min = 0,
        sec = 0,
    }
    return os.date("*t", timestamp).wday
end

local function weekStart(value)
    local weekday = weekdayNumber(value)
    if not weekday then
        return nil
    end

    -- os.date uses Sunday=1; convert it to a Monday-based offset.
    local monday_offset = (weekday + 5) % 7
    return DateUtils.addDays(value, -monday_offset)
end

local function eventDate(event, field)
    if type(event) ~= "table" then
        return nil
    end
    return dateFromValue(event[field or "startAt"])
end

local function eventSortKey(event)
    return tostring(event.startAt or "") .. "\0" .. tostring(event.id or "")
end

local function copyAndSort(events)
    local result = {}
    for _, event in ipairs(events or {}) do
        result[#result + 1] = event
    end
    table.sort(result, function(left, right)
        return eventSortKey(left) < eventSortKey(right)
    end)
    return result
end

local function maxDate(left, right)
    return left > right and left or right
end

local function minDate(left, right)
    return left < right and left or right
end

function CalendarData.modeLabel(mode)
    return MODE_LABELS[mode] or MODE_LABELS.agenda
end

function CalendarData.dateLabel(value)
    local parts = DateUtils.parseDateKey(value)
    if not parts then
        return tostring(value or "")
    end
    return string.format("%02d/%02d/%04d", parts.day, parts.month, parts.year)
end

function CalendarData.shortDateLabel(value)
    local parts = DateUtils.parseDateKey(value)
    if not parts then
        return tostring(value or "")
    end
    return string.format("%02d/%02d", parts.day, parts.month)
end

function CalendarData.dayLabel(value)
    local parts = DateUtils.parseDateKey(value)
    local weekday = weekdayNumber(value)
    if not parts or not weekday then
        return tostring(value or "")
    end
    return string.format(
        "%s %02d/%02d/%04d",
        WEEKDAYS_SHORT[weekday],
        parts.day,
        parts.month,
        parts.year
    )
end

function CalendarData.fullDayLabel(value)
    local parts = DateUtils.parseDateKey(value)
    local weekday = weekdayNumber(value)
    if not parts or not weekday then
        return tostring(value or "")
    end
    return string.format(
        "%s %02d de %s de %04d",
        WEEKDAYS_FULL[weekday],
        parts.day,
        MONTHS[parts.month],
        parts.year
    )
end

function CalendarData.compactDayLabel(value)
    local parts = DateUtils.parseDateKey(value)
    local weekday = weekdayNumber(value)
    if not parts or not weekday then
        return tostring(value or "")
    end
    return string.format("%s %02d/%02d", WEEKDAYS_SHORT[weekday], parts.day, parts.month)
end

function CalendarData.periodLabel(mode, cursor)
    local parts = DateUtils.parseDateKey(cursor)
    if not parts then
        return ""
    end

    if mode == "month" then
        return string.format("%s de %04d", MONTHS[parts.month], parts.year)
    end

    if mode == "week" then
        local finish = DateUtils.addDays(cursor, 6)
        return string.format(
            "Semana del %s al %s",
            CalendarData.shortDateLabel(cursor),
            CalendarData.shortDateLabel(finish)
        )
    end

    if mode == "day" then
        local weekday = weekdayNumber(cursor)
        return string.format(
            "%s %02d de %s de %04d",
            WEEKDAYS_FULL[weekday],
            parts.day,
            MONTHS[parts.month],
            parts.year
        )
    end

    return "Desde " .. CalendarData.dateLabel(cursor)
end

function CalendarData.normalizeCursor(mode, value)
    if not DateUtils.isDateKey(value) then
        return nil
    end

    if mode == "month" then
        return monthStart(value)
    end
    if mode == "week" then
        return weekStart(value)
    end
    return value
end

function CalendarData.shift(mode, cursor, direction)
    if type(direction) ~= "number" or direction % 1 ~= 0 then
        return nil
    end

    local normalized = CalendarData.normalizeCursor(mode, cursor)
    if not normalized then
        return nil
    end

    if mode == "month" then
        return shiftMonth(normalized, direction)
    end
    if mode == "week" or mode == "agenda" then
        return DateUtils.addDays(normalized, direction * 7)
    end
    return DateUtils.addDays(normalized, direction)
end

function CalendarData.period(mode, cursor, agendaEnd)
    local normalized = CalendarData.normalizeCursor(mode, cursor)
    if not normalized then
        return nil
    end

    local finish
    if mode == "month" then
        finish = shiftMonth(normalized, 1)
    elseif mode == "week" then
        finish = DateUtils.addDays(normalized, 7)
    elseif mode == "day" then
        finish = DateUtils.addDays(normalized, 1)
    else
        finish = agendaEnd
    end

    if not finish or finish <= normalized then
        return nil
    end
    return {
        from = normalized,
        to = finish,
    }
end

function CalendarData.clipPeriod(period, window)
    if not period or type(window) ~= "table"
        or not DateUtils.isDateKey(window.from)
        or not DateUtils.isDateKey(window.to)
    then
        return nil
    end

    local from = maxDate(period.from, window.from)
    local to = minDate(period.to, window.to)
    if from >= to then
        return nil
    end
    return {
        from = from,
        to = to,
    }
end

function CalendarData.isPeriodCovered(period, window)
    return period ~= nil and type(window) == "table"
        and period.from >= window.from and period.to <= window.to
end

function CalendarData.eventStartDate(event)
    return eventDate(event, "startAt")
end

function CalendarData.eventEndDate(event)
    local start_date = CalendarData.eventStartDate(event)
    local end_date = eventDate(event, "endAt") or start_date
    if type(event) == "table" and not event.allDay and end_date and start_date
        and end_date > start_date and type(event.endAt) == "string"
        and event.endAt:match("T00:00:00")
    then
        return DateUtils.addDays(end_date, -1)
    end
    return end_date
end

function CalendarData.daysRemaining(event, today)
    if type(event) ~= "table" or not DateUtils.isDateKey(today) then
        return nil
    end
    return DateUtils.daysBetween(today, CalendarData.eventEndDate(event))
end

function CalendarData.eventOverlaps(event, period)
    if type(event) ~= "table" or not period then
        return false
    end

    local start_date = CalendarData.eventStartDate(event)
    local end_date = CalendarData.eventEndDate(event)
    if not start_date or not end_date then
        return false
    end

    return end_date >= period.from and start_date < period.to
end

function CalendarData.filterEvents(events, period)
    local result = {}
    for _, event in ipairs(events or {}) do
        if CalendarData.eventOverlaps(event, period) then
            result[#result + 1] = event
        end
    end
    return copyAndSort(result)
end

function CalendarData.groupEvents(events, period, includeEmpty)
    if not period then
        return {}
    end

    local byDate = {}
    for _, event in ipairs(events or {}) do
        local date = CalendarData.eventStartDate(event)
        if date and date < period.from then
            date = period.from
        end
        if date and date >= period.from and date < period.to then
            byDate[date] = byDate[date] or {}
            byDate[date][#byDate[date] + 1] = event
        end
    end

    local result = {}
    local date = period.from
    while date and date < period.to do
        if includeEmpty or byDate[date] then
            result[#result + 1] = {
                date = date,
                events = copyAndSort(byDate[date] or {}),
            }
        end
        date = DateUtils.addDays(date, 1)
    end
    return result
end

function CalendarData.countEventsByDate(events, period)
    local counts = {}
    if not period then
        return counts
    end

    local last_date = DateUtils.addDays(period.to, -1)
    for _, event in ipairs(events or {}) do
        local start_date = CalendarData.eventStartDate(event)
        local end_date = CalendarData.eventEndDate(event)
        if start_date and end_date then
            local from = maxDate(start_date, period.from)
            local to = minDate(end_date, last_date)
            local date = from
            while date and date <= to do
                counts[date] = (counts[date] or 0) + 1
                date = DateUtils.addDays(date, 1)
            end
        end
    end
    return counts
end

function CalendarData.previewEvents(events, period, anchor, limit)
    if not period or not DateUtils.isDateKey(period.from)
        or not DateUtils.isDateKey(period.to) or period.from >= period.to
    then
        return {}, 0
    end

    local reference = DateUtils.isDateKey(anchor) and maxDate(anchor, period.from) or period.from
    local upcoming = {}
    for _, event in ipairs(copyAndSort(events)) do
        local end_date = CalendarData.eventEndDate(event)
        if end_date and end_date >= reference and CalendarData.eventOverlaps(event, period) then
            upcoming[#upcoming + 1] = event
        end
    end

    local total = #upcoming
    if type(limit) == "number" and limit >= 0 then
        while #upcoming > limit do
            table.remove(upcoming)
        end
    end
    return upcoming, total
end

function CalendarData.monthGrid(period, events, visiblePeriod)
    if not period then
        return {}
    end

    local weekday = weekdayNumber(period.from)
    if not weekday then
        return {}
    end

    local first_offset = (weekday + 5) % 7
    local grid_start = DateUtils.addDays(period.from, -first_offset)
    local last_date = DateUtils.addDays(period.to, -1)
    local last_weekday = weekdayNumber(last_date)
    local last_offset = 7 - ((last_weekday + 5) % 7) - 1
    local grid_end = DateUtils.addDays(last_date, last_offset + 1)
    local counts = CalendarData.countEventsByDate(events, visiblePeriod)
    local rows = {}
    local date = grid_start

    while date and date < grid_end do
        local row = {}
        for _ = 1, 7 do
            row[#row + 1] = {
                date = date,
                inPeriod = date >= period.from and date < period.to,
                available = visiblePeriod ~= nil
                    and date >= visiblePeriod.from and date < visiblePeriod.to,
                count = counts[date] or 0,
            }
            date = DateUtils.addDays(date, 1)
        end
        rows[#rows + 1] = row
    end
    return rows
end

function CalendarData.weekGrid(period, events, visiblePeriod)
    if not period then
        return {}
    end

    local counts = CalendarData.countEventsByDate(events, visiblePeriod)
    local row = {}
    local date = period.from
    for _ = 1, 7 do
        row[#row + 1] = {
            date = date,
            inPeriod = date >= period.from and date < period.to,
            available = visiblePeriod ~= nil
                and date >= visiblePeriod.from and date < visiblePeriod.to,
            count = counts[date] or 0,
        }
        date = DateUtils.addDays(date, 1)
    end
    return { row }
end

function CalendarData.initialCursor(snapshot, today)
    local window = snapshot and snapshot.window
    if type(window) ~= "table" then
        return today or DateUtils.todayKey()
    end

    local candidate = today or DateUtils.todayKey()
    if DateUtils.isDateKey(candidate) and candidate >= window.from and candidate < window.to then
        return candidate
    end

    local first_event
    for _, event in ipairs(snapshot.events or {}) do
        local date = CalendarData.eventStartDate(event)
        if date and date >= window.from and date < window.to
            and (not first_event or date < first_event)
        then
            first_event = date
        end
    end
    return first_event or window.from
end

function CalendarData.eventsForPeriod(snapshot, mode, cursor)
    local period = CalendarData.period(mode, cursor, snapshot.window.to)
    local visible = CalendarData.clipPeriod(period, snapshot.window)
    return {
        period = period,
        visiblePeriod = visible,
        events = CalendarData.filterEvents(snapshot.events, visible),
    }
end

return CalendarData
