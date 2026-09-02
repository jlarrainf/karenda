local DateUtils = require("date_utils")
local json = require("json")

local SnapshotMapper = {}
local JSON_NULL = json.util and json.util.null

local function optionalValue(value)
    if JSON_NULL and value == JSON_NULL then
        return nil
    end
    return value
end

local function optionalField(row, key)
    if type(row) ~= "table" then
        return nil
    end
    return optionalValue(row[key])
end

local function failure(message)
    return nil, {
        code = "INVALID_SNAPSHOT",
        message = message,
    }
end

local function isNonEmptyString(value)
    return type(value) == "string" and value ~= ""
end

local function isArray(value)
    if type(value) ~= "table" then
        return false
    end

    local count = 0
    for key in pairs(value) do
        if type(key) ~= "number" or key < 1 or key % 1 ~= 0 then
            return false
        end
        count = math.max(count, key)
    end

    for index = 1, count do
        if value[index] == nil then
            return false
        end
    end

    return true
end

local function hasUniqueIds(rows)
    local ids = {}
    for _, row in ipairs(rows) do
        if not isNonEmptyString(row.id) or ids[row.id] then
            return false
        end
        ids[row.id] = true
    end
    return true, ids
end

local function isRfc3339(value)
    if type(value) ~= "string" then
        return false
    end

    local date, hour, minute, second = value:match(
        "^(%d%d%d%d%-%d%d%-%d%d)T(%d%d):(%d%d):(%d%d)"
    )
    if not date or not DateUtils.isDateKey(date) then
        return false
    end

    if tonumber(hour) > 23 or tonumber(minute) > 59 or tonumber(second) > 60 then
        return false
    end

    local prefix = value:sub(1, 19)
    local suffix = value:sub(20)
    if prefix ~= string.format("%sT%s:%s:%s", date, hour, minute, second) then
        return false
    end

    if suffix == "Z" or suffix:match("^%.%d+Z$") then
        return true
    end

    local offset_hour, offset_minute = suffix:match("^[%+%-](%d%d):(%d%d)$")
    if not offset_hour then
        offset_hour, offset_minute = suffix:match("^%.%d+[%+%-](%d%d):(%d%d)$")
    end

    return offset_hour ~= nil
        and tonumber(offset_hour) <= 23
        and tonumber(offset_minute) <= 59
end

local function validateTimestamp(value, required)
    if value == nil and not required then
        return true
    end
    return isRfc3339(value)
end

local function mapSubject(row)
    local updated_at = optionalField(row, "updated_at")
    if type(row) ~= "table"
        or not isNonEmptyString(row.id)
        or not isNonEmptyString(row.name)
        or not isNonEmptyString(row.code)
        or not isNonEmptyString(row.abbreviation)
        or type(row.color) ~= "string"
        or not validateTimestamp(updated_at, false)
    then
        return nil
    end

    return {
        id = row.id,
        name = row.name,
        code = row.code,
        abbreviation = row.abbreviation,
        color = row.color,
        updatedAt = updated_at,
    }
end

local function mapPersonalGroup(row)
    local color = optionalField(row, "color")
    local updated_at = optionalField(row, "updated_at")
    if type(row) ~= "table"
        or not isNonEmptyString(row.id)
        or not isNonEmptyString(row.name)
        or (color ~= nil and type(color) ~= "string")
        or not validateTimestamp(updated_at, false)
    then
        return nil
    end

    return {
        id = row.id,
        name = row.name,
        color = color,
        updatedAt = updated_at,
    }
end

local function mapEvent(row, subjectIds, personalGroupIds)
    local subject_id = optionalField(row, "subject_id")
    local personal_group_id = optionalField(row, "personal_group_id")
    local end_at = optionalField(row, "end_at")
    local location = optionalField(row, "location")
    local description = optionalField(row, "description")
    local updated_at = optionalField(row, "updated_at")
    if type(row) ~= "table"
        or not isNonEmptyString(row.id)
        or not isNonEmptyString(row.title)
        or (row.kind ~= "academic" and row.kind ~= "personal")
        or (row.status ~= "pending" and row.status ~= "completed")
        or type(row.all_day) ~= "boolean"
        or not isNonEmptyString(row.start_at)
        or not validateTimestamp(updated_at, false)
    then
        return nil
    end

    if row.kind == "academic" and not isNonEmptyString(subject_id) then
        return nil
    end
    if row.kind == "personal" and subject_id ~= nil then
        return nil
    end
    if subject_id ~= nil and not subjectIds[subject_id] then
        return nil
    end
    if personal_group_id ~= nil and not personalGroupIds[personal_group_id] then
        return nil
    end

    if row.all_day then
        if not DateUtils.isDateKey(row.start_at) then
            return nil
        end
        if end_at ~= nil
            and (not DateUtils.isDateKey(end_at) or end_at < row.start_at)
        then
            return nil
        end
    else
        if not isRfc3339(row.start_at) or not validateTimestamp(end_at, false) then
            return nil
        end
    end

    return {
        id = row.id,
        kind = row.kind,
        title = row.title,
        subjectId = subject_id,
        personalGroupId = personal_group_id,
        startAt = row.start_at,
        endAt = end_at,
        allDay = row.all_day,
        status = row.status,
        location = location,
        description = description,
        updatedAt = updated_at,
    }
end

local function mapNote(row, subjectIds, personalGroupIds)
    local updated_at = optionalField(row, "updated_at")
    if type(row) ~= "table"
        or not isNonEmptyString(row.id)
        or (row.target_type ~= "subject" and row.target_type ~= "personal_group")
        or not isNonEmptyString(row.target_id)
        or not isNonEmptyString(row.title)
        or type(row.content_markdown) ~= "string"
        or not validateTimestamp(updated_at, false)
    then
        return nil
    end

    if row.target_type == "subject" and not subjectIds[row.target_id] then
        return nil
    end
    if row.target_type == "personal_group" and not personalGroupIds[row.target_id] then
        return nil
    end

    return {
        id = row.id,
        targetType = row.target_type,
        targetId = row.target_id,
        title = row.title,
        contentMarkdown = row.content_markdown,
        updatedAt = updated_at,
    }
end

function SnapshotMapper.map(payload)
    if type(payload) ~= "table"
        or payload.schema_version ~= 1
        or not isNonEmptyString(payload.snapshot_id)
        or not isNonEmptyString(payload.generated_at)
        or not isRfc3339(payload.generated_at)
        or not isNonEmptyString(payload.timezone)
        or type(payload.window) ~= "table"
        or not DateUtils.isDateKey(payload.window.from)
        or not DateUtils.isDateKey(payload.window.to)
        or payload.window.from >= payload.window.to
        or not isArray(payload.subjects)
        or not isArray(payload.personal_groups)
        or not isArray(payload.events)
        or not isArray(payload.notes)
    then
        return failure("El snapshot recibido no cumple el contrato.")
    end

    local subjects = {}
    for _, row in ipairs(payload.subjects) do
        local mapped = mapSubject(row)
        if not mapped then
            return failure("El catálogo de asignaturas no es válido.")
        end
        table.insert(subjects, mapped)
    end
    local subjects_ok, subject_ids = hasUniqueIds(subjects)
    if not subjects_ok then
        return failure("El catálogo de asignaturas contiene identificadores repetidos.")
    end

    local personal_groups = {}
    for _, row in ipairs(payload.personal_groups) do
        local mapped = mapPersonalGroup(row)
        if not mapped then
            return failure("El catálogo de grupos personales no es válido.")
        end
        table.insert(personal_groups, mapped)
    end
    local groups_ok, personal_group_ids = hasUniqueIds(personal_groups)
    if not groups_ok then
        return failure("El catálogo de grupos personales contiene identificadores repetidos.")
    end

    local events = {}
    for _, row in ipairs(payload.events) do
        local mapped = mapEvent(row, subject_ids, personal_group_ids)
        if not mapped then
            return failure("La agenda contiene un evento no válido.")
        end
        table.insert(events, mapped)
    end
    local events_ok = hasUniqueIds(events)
    if not events_ok then
        return failure("La agenda contiene identificadores repetidos.")
    end

    local notes = {}
    for _, row in ipairs(payload.notes) do
        local mapped = mapNote(row, subject_ids, personal_group_ids)
        if not mapped then
            return failure("Las notas contienen una referencia no válida.")
        end
        table.insert(notes, mapped)
    end
    local notes_ok = hasUniqueIds(notes)
    if not notes_ok then
        return failure("Las notas contienen identificadores repetidos.")
    end

    return {
        schemaVersion = payload.schema_version,
        snapshotId = payload.snapshot_id,
        generatedAt = payload.generated_at,
        timezone = payload.timezone,
        window = {
            from = payload.window.from,
            to = payload.window.to,
        },
        subjects = subjects,
        personalGroups = personal_groups,
        events = events,
        notes = notes,
    }
end

return SnapshotMapper
