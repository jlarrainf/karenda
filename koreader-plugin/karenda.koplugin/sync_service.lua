local UIManager = require("ui/uimanager")
local logger = require("logger")

local ApiClient = require("api_client")
local Config = require("config")
local HttpTransport = require("http_transport")
local Runtime = require("runtime")
local SnapshotMapper = require("snapshot_mapper")
local SnapshotStore = require("snapshot_store")

local SyncService = {}
SyncService.__index = SyncService

local function safeFailure(code, message)
    return {
        kind = "error",
        code = code,
        message = message,
    }
end

local function asResult(value)
    if value and value.kind then
        return value
    end

    return safeFailure(
        value and value.code or "BACKEND_UNAVAILABLE",
        value and value.message or "La sincronización no está disponible."
    )
end

function SyncService:new(options)
    options = options or {}
    return setmetatable({
        config = options.config or Config,
        store = options.store or SnapshotStore:new(),
        apiClient = options.apiClient or ApiClient:new{
            transport = options.transport or HttpTransport:new(),
        },
        runtime = options.runtime or Runtime,
        clock = options.clock or os.time,
    }, self)
end

function SyncService:sync(reason, callback)
    callback = callback or function() end
    if not self.runtime.beginSync() then
        callback(safeFailure("BUSY", "Ya hay una sincronización en curso."))
        return false
    end

    local function finish(result)
        self.runtime.finishSync()
        callback(asResult(result))
    end

    local values, config_error = self.config.load()
    if config_error then
        logger.warn("No se pudo cargar la configuración de Karenda.")
    end

    if type(values.deviceToken) ~= "string" or values.deviceToken == "" then
        finish(safeFailure("NOT_CONFIGURED", "Configura un token de dispositivo para sincronizar."))
        return false
    end

    local request, request_error = self.apiClient:buildRequest(values, self.clock())
    if not request then
        finish(request_error)
        return false
    end

    local previous, store_error = self.store:load()
    if store_error then
        logger.warn("Se ignoró el snapshot local de Karenda.")
    end

    local previous_etag
    if previous and previous.metadata.requestKey == request.requestKey then
        previous_etag = previous.metadata.etag
    end

    local started = self.apiClient:fetchSnapshot(request, previous_etag, function(result)
        if result.kind == "snapshot" then
            local snapshot, map_error = SnapshotMapper.map(result.payload)
            if not snapshot then
                finish(map_error)
                return
            end

            local checkedAt = self.clock()
            local saved, save_error = self.store:save(result.payload, {
                etag = result.etag,
                lastCheckedAt = checkedAt,
                requestKey = request.requestKey,
            })
            if not saved then
                finish(save_error)
                return
            end

            self.config.save({ lastCheckedAt = checkedAt })
            finish({
                kind = "updated",
                snapshot = snapshot,
                etag = result.etag,
                reason = reason,
                message = "Sincronización completada.",
            })
            return
        end

        if result.kind == "not_modified" then
            if not previous then
                finish(safeFailure("INVALID_SNAPSHOT", "No existe una caché local para conservar."))
                return
            end

            local checkedAt = self.clock()
            self.config.save({ lastCheckedAt = checkedAt })
            finish({
                kind = "not_modified",
                snapshot = previous.snapshot,
                etag = result.etag or previous.metadata.etag,
                reason = reason,
                message = "La agenda ya estaba actualizada.",
            })
            return
        end

        finish(result)
    end)

    if not started then
        return false
    end
    return true
end

function SyncService:onResume()
    local values = self.config.load()
    local interval = tonumber(values.syncIntervalSeconds)
    if not interval or interval <= 0 then
        return false
    end

    local now = self.clock()
    if values.lastCheckedAt and now - values.lastCheckedAt < interval then
        return false
    end

    UIManager:nextTick(function()
        self:sync("resume", function(result)
            if result.kind == "error" then
                logger.warn("Falló la sincronización automática de Karenda.")
            end
        end)
    end)
    return true
end

return SyncService
