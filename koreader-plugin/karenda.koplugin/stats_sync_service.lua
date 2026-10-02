local UIManager = require("ui/uimanager")
local logger = require("logger")

local DateUtils = require("date_utils")
local Config = require("config")
local HttpTransport = require("http_transport")
local StatsApiClient = require("stats_api_client")
local StatisticsCollector = require("statistics_collector")
local AnkiStatsAdapter = require("anki_stats_adapter")
local StatsSyncStore = require("stats_sync_store")

local StatsSyncService = {}
StatsSyncService.__index = StatsSyncService

local READING_FIELDS = {
    reading_pages = "pages",
    reading_minutes = "minutes",
    books_completed = "books",
}

local function failure(code, message)
    return { kind = "error", code = code, message = message }
end

local function mergeObservation(by_key, observation)
    by_key[observation.link_id .. ":" .. observation.local_date] = observation
end

local function observationsFromStats(links, reading_stats, anki_stats, from_date, to_date)
    local observations = {}
    for _, link in ipairs(links or {}) do
        local stats
        local field = READING_FIELDS[link.metric_key]
        if field and reading_stats then
            stats = reading_stats
        elseif link.metric_key == "anki_cards_reviewed" and anki_stats then
            stats = anki_stats
            field = "reviewed"
        end

        if stats and field then
            local start_date = link.start_date or from_date
            local end_date = link.end_date or to_date
            local date_key = from_date
            while date_key and date_key <= to_date do
                if date_key >= start_date and date_key <= end_date then
                    local daily = stats[date_key]
                    local value = daily and daily[field] or 0
                    if type(value) == "number" and value >= 0 then
                        table.insert(observations, {
                            external_id = link.id .. ":" .. date_key,
                            link_id = link.id,
                            local_date = date_key,
                            value = value,
                        })
                    end
                end
                date_key = DateUtils.addDays(date_key, 1)
            end
        end
    end
    table.sort(observations, function(left, right)
        if left.local_date == right.local_date then return left.link_id < right.link_id end
        return left.local_date < right.local_date
    end)
    return observations
end

function StatsSyncService:new(options)
    options = options or {}
    return setmetatable({
        config = options.config or Config,
        store = options.store or StatsSyncStore:new(),
        apiClient = options.apiClient or StatsApiClient:new{
            transport = options.transport or HttpTransport:new(),
        },
        collector = options.collector or StatisticsCollector:new(),
        anki = options.anki or AnkiStatsAdapter:new(),
        clock = options.clock or os.time,
        inFlight = false,
    }, self)
end

function StatsSyncService:sync(reason, callback)
    callback = callback or function() end
    if self.inFlight then
        callback(failure("BUSY", "Ya hay una sincronización de estadísticas en curso."))
        return false
    end
    self.inFlight = true

    local function finish(result)
        self.inFlight = false
        callback(result)
    end

    local values, config_error = self.config.load()
    if config_error then logger.warn("No se pudo cargar la configuración para las estadísticas.") end
    if type(values.deviceToken) ~= "string" or values.deviceToken == "" then
        finish(failure("NOT_CONFIGURED", "Vincula el dispositivo antes de sincronizar estadísticas."))
        return false
    end

    local state, state_error = self.store:load()
    if state_error then logger.warn("Se restableció la cola local de estadísticas.") end
    local today = DateUtils.todayKey(self.clock())
    local year = tonumber(today:sub(1, 4))
    local is_backfill = state.backfillYear ~= year
    local from_date = is_backfill and (today:sub(1, 4) .. "-01-01") or DateUtils.addDays(today, -7)
    local to_date = today

    local started = self.apiClient:getConfig(values, function(config_result)
        if config_result.kind ~= "config" then
            finish(config_result)
            return
        end
        local links = config_result.links or {}
        if #links == 0 then
            finish({ kind = "not_configured", message = "No hay hábitos vinculados a estadísticas." })
            return
        end

        local reading_stats, reading_error = self.collector:getDailyStats(from_date, to_date)
        local anki_stats, anki_error = self.anki:getDailyStats(from_date, to_date, config_result.timezone or values.timezone)
        local reading_links = false
        local anki_links = false
        for _, link in ipairs(links) do
            if READING_FIELDS[link.metric_key] then reading_links = true end
            if link.metric_key == "anki_cards_reviewed" then anki_links = true end
        end

        local unavailable = {}
        if reading_links and not reading_stats then unavailable.reading = reading_error end
        if anki_links and not anki_stats then unavailable.anki = anki_error end

        local by_key = {}
        local active_link_ids = {}
        for _, link in ipairs(links) do active_link_ids[link.id] = true end
        for _, observation in ipairs(state.pending or {}) do
            if active_link_ids[observation.link_id] then mergeObservation(by_key, observation) end
        end
        for _, observation in ipairs(observationsFromStats(links, reading_stats, anki_stats, from_date, to_date)) do
            mergeObservation(by_key, observation)
        end
        local observations = {}
        for _, observation in pairs(by_key) do table.insert(observations, observation) end
        table.sort(observations, function(left, right)
            return left.local_date == right.local_date and left.link_id < right.link_id
                or left.local_date < right.local_date
        end)

        local fully_available = not unavailable.reading and not unavailable.anki
        if #observations == 0 then
            if not fully_available then
                local warning = unavailable.anki and unavailable.anki.message or unavailable.reading.message
                finish({ kind = "partial", code = "SOURCE_UNAVAILABLE", message = warning })
                return
            end
            state.pending = {}
            state.lastSyncDate = today
            if is_backfill then state.backfillYear = year end
            self.store:save(state)
            finish({ kind = "updated", count = 0, message = "No había estadísticas nuevas para enviar." })
            return
        end

        self.apiClient:sendBatch(values, config_result.timezone or values.timezone, observations, function(send_result)
            if send_result.kind ~= "ok" then
                state.pending = observations
                self.store:save(state)
                finish(send_result)
                return
            end
            state.pending = {}
            state.lastSyncDate = today
            if is_backfill and fully_available then state.backfillYear = year end
            self.store:save(state)
            local message = string.format("Se actualizaron %d registros diarios de estadísticas.", #observations)
            if not fully_available then
                message = message .. " " .. (unavailable.anki and unavailable.anki.message or unavailable.reading.message)
            end
            finish({ kind = fully_available and "updated" or "partial", count = #observations, message = message })
        end)
    end)

    if not started then
        self.inFlight = false
        return false
    end
    return true
end

function StatsSyncService:onResume()
    if self.inFlight then return false end
    local values = self.config.load()
    if type(values.deviceToken) ~= "string" or values.deviceToken == "" then return false end
    local state = self.store:load()
    local today = DateUtils.todayKey(self.clock())
    local year = tonumber(today:sub(1, 4))
    if state.lastSyncDate == today and state.backfillYear == year and #(state.pending or {}) == 0 then
        return false
    end

    UIManager:nextTick(function()
        self:sync("resume", function(result)
            if result.kind == "error" or result.kind == "partial" then
                logger.warn("Falló la sincronización automática de estadísticas.")
            end
        end)
    end)
    return true
end

return StatsSyncService
