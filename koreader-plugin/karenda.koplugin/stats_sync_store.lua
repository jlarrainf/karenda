local DataStorage = require("datastorage")
local json = require("json")
local util = require("util")

local StatsSyncStore = {}
StatsSyncStore.__index = StatsSyncStore

local MAX_JSON_BYTES = 512 * 1024

local function defaultState()
    return {
        backfillYear = nil,
        lastSyncDate = nil,
        pending = {},
    }
end

function StatsSyncStore:new(options)
    options = options or {}
    local dataDir = options.dataDir or (DataStorage:getSettingsDir() .. "/karenda")
    return setmetatable({
        dataDir = dataDir,
        path = options.path or (dataDir .. "/stats-sync.json"),
        temporaryPath = options.temporaryPath or (dataDir .. "/stats-sync.json.part"),
        fileExists = options.fileExists or util.fileExists,
        read = options.read or util.readFromFile,
        write = options.write or util.writeToFile,
        makePath = options.makePath or util.makePath,
    }, self)
end

function StatsSyncStore:load()
    if not self.fileExists(self.path) then return defaultState() end
    local raw, read_error = self.read(self.path, "rb")
    if not raw then
        return defaultState(), {
            code = "STORE_ERROR",
            message = "No se pudo leer la cola de estadísticas.",
            detail = read_error,
        }
    end

    local ok, value = pcall(json.decode, raw)
    if not ok or type(value) ~= "table" then
        return defaultState(), {
            code = "STORE_ERROR",
            message = "La cola local de estadísticas no es válida.",
        }
    end

    local state = defaultState()
    if type(value.backfillYear) == "number" then state.backfillYear = value.backfillYear end
    if type(value.lastSyncDate) == "string" then state.lastSyncDate = value.lastSyncDate end
    if type(value.pending) == "table" then state.pending = value.pending end
    return state
end

function StatsSyncStore:save(state)
    local ok, encoded = pcall(json.encode, {
        backfillYear = state.backfillYear,
        lastSyncDate = state.lastSyncDate,
        pending = state.pending or {},
    })
    if not ok or type(encoded) ~= "string" or #encoded > MAX_JSON_BYTES then
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo preparar la cola de estadísticas.",
        }
    end

    local path_ok, path_error = self.makePath(self.dataDir)
    if not path_ok then
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo preparar el almacenamiento de estadísticas.",
            detail = path_error,
        }
    end

    local written, write_error = self.write(encoded, self.temporaryPath, true, false)
    if not written then
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo guardar la cola de estadísticas.",
            detail = write_error,
        }
    end

    local renamed, rename_error = os.rename(self.temporaryPath, self.path)
    if not renamed then
        os.remove(self.temporaryPath)
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo finalizar la cola de estadísticas.",
            detail = rename_error,
        }
    end
    return true
end

return StatsSyncStore
