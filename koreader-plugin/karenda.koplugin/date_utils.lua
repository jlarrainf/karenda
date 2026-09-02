local DateUtils = {}

local function isLeapYear(year)
    return year % 4 == 0 and (year % 100 ~= 0 or year % 400 == 0)
end

local function daysInMonth(year, month)
    local days = {
        31,
        isLeapYear(year) and 29 or 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    }
    return days[month]
end

function DateUtils.parseDateKey(value)
    if type(value) ~= "string" then
        return nil
    end

    local year, month, day = value:match("^(%d%d%d%d)%-(%d%d)%-(%d%d)$")
    year, month, day = tonumber(year), tonumber(month), tonumber(day)
    if not year or not month or not day then
        return nil
    end

    if month < 1 or month > 12 or day < 1 or day > daysInMonth(year, month) then
        return nil
    end

    return { year = year, month = month, day = day }
end

function DateUtils.isDateKey(value)
    return DateUtils.parseDateKey(value) ~= nil
end

function DateUtils.formatDateKey(parts)
    return string.format("%04d-%02d-%02d", parts.year, parts.month, parts.day)
end

function DateUtils.addDays(value, offset)
    local parts = DateUtils.parseDateKey(value)
    if not parts or type(offset) ~= "number" or offset % 1 ~= 0 then
        return nil
    end

    local step = offset >= 0 and 1 or -1
    for _ = 1, math.abs(offset) do
        parts.day = parts.day + step
        if parts.day > daysInMonth(parts.year, parts.month) then
            parts.day = 1
            parts.month = parts.month + 1
            if parts.month > 12 then
                parts.month = 1
                parts.year = parts.year + 1
            end
        elseif parts.day < 1 then
            parts.month = parts.month - 1
            if parts.month < 1 then
                parts.month = 12
                parts.year = parts.year - 1
            end
            parts.day = daysInMonth(parts.year, parts.month)
        end
    end

    return DateUtils.formatDateKey(parts)
end

local function daysBeforeYear(year)
    local previous = year - 1
    return 365 * previous
        + math.floor(previous / 4)
        - math.floor(previous / 100)
        + math.floor(previous / 400)
end

local function dateOrdinal(parts)
    local ordinal = daysBeforeYear(parts.year)
    for month = 1, parts.month - 1 do
        ordinal = ordinal + daysInMonth(parts.year, month)
    end
    return ordinal + parts.day
end

function DateUtils.daysBetween(fromValue, toValue)
    local from = DateUtils.parseDateKey(fromValue)
    local to = DateUtils.parseDateKey(toValue)
    if not from or not to then
        return nil
    end
    return dateOrdinal(to) - dateOrdinal(from)
end

function DateUtils.todayKey(now)
    local parts = os.date("*t", now or os.time())
    return DateUtils.formatDateKey{
        year = parts.year,
        month = parts.month,
        day = parts.day,
    }
end

function DateUtils.secondsUntilNextDay(now)
    local timestamp = now or os.time()
    local parts = os.date("*t", timestamp)
    local next_day = os.time{
        year = parts.year,
        month = parts.month,
        day = parts.day + 1,
        hour = 0,
        min = 0,
        sec = 0,
    }
    return math.max(1, next_day - timestamp)
end

function DateUtils.resolveWindow(values, now)
    local timezone = values.timezone
    if type(timezone) ~= "string" or timezone == "" then
        return nil, {
            code = "INVALID_REQUEST",
            message = "La zona horaria no está configurada.",
        }
    end

    local fromDate = values.fromDate
    local toDate = values.toDate
    if not fromDate and not toDate then
        local today = DateUtils.todayKey(now)
        fromDate = DateUtils.addDays(today, -7)
        toDate = DateUtils.addDays(today, 180)
    end

    if not DateUtils.isDateKey(fromDate) or not DateUtils.isDateKey(toDate) or fromDate >= toDate then
        return nil, {
            code = "INVALID_REQUEST",
            message = "La ventana de fechas no es válida.",
        }
    end

    return {
        from = fromDate,
        to = toDate,
        timezone = timezone,
    }
end

return DateUtils
