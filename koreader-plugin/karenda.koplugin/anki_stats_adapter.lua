local DateUtils = require("date_utils")

local AnkiStatsAdapter = {}
AnkiStatsAdapter.__index = AnkiStatsAdapter

local function unavailable()
    return nil, {
        code = "ANKI_UNAVAILABLE",
        message = "Las estadísticas de Anki no están disponibles en este Kindle.",
    }
end

function AnkiStatsAdapter:new(options)
    options = options or {}
    local provider = options.provider
    if provider == nil then
        local ok, loaded = pcall(require, "anki_statistics_provider")
        if ok then provider = loaded end
    end
    return setmetatable({ provider = provider }, self)
end

function AnkiStatsAdapter:getDailyStats(from_date, to_date, timezone)
    if not DateUtils.isDateKey(from_date) or not DateUtils.isDateKey(to_date) or from_date > to_date then
        return nil, {
            code = "INVALID_REQUEST",
            message = "El periodo de estadísticas no es válido.",
        }
    end
    if not self.provider or type(self.provider.getDailyStats) ~= "function" then
        return unavailable()
    end

    local ok, result = pcall(self.provider.getDailyStats, from_date, to_date, timezone)
    if not ok then
        ok, result = pcall(self.provider.getDailyStats, self.provider, from_date, to_date, timezone)
    end
    if not ok or type(result) ~= "table" then
        return nil, {
            code = "ANKI_UNAVAILABLE",
            message = "No se pudo leer el historial de Anki.",
        }
    end

    local normalized = {}
    for date_key, value in pairs(result) do
        if DateUtils.isDateKey(date_key) and date_key >= from_date and date_key <= to_date then
            local reviewed = type(value) == "table" and value.reviewed or value
            if type(reviewed) == "number" and reviewed >= 0 and reviewed % 1 == 0 then
                normalized[date_key] = { reviewed = reviewed }
            end
        end
    end
    return normalized
end

return AnkiStatsAdapter
