local DataStorage = require("datastorage")
local json = require("json")
local util = require("util")

local SnapshotMapper = require("snapshot_mapper")

local SnapshotStore = {}
SnapshotStore.__index = SnapshotStore

local MAX_JSON_BYTES = 1024 * 1024

function SnapshotStore:new(options)
    options = options or {}
    local dataDir = options.dataDir or (DataStorage:getSettingsDir() .. "/karenda")
    return setmetatable({
        dataDir = dataDir,
        path = dataDir .. "/snapshot.json",
        temporaryPath = dataDir .. "/snapshot.json.part",
    }, self)
end

local function encode(value)
    local ok, encoded = pcall(json.encode, value)
    if not ok or type(encoded) ~= "string" then
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo preparar el snapshot local.",
        }
    end
    return encoded
end

function SnapshotStore:load()
    if not util.fileExists(self.path) then
        return nil
    end

    local raw, read_error = util.readFromFile(self.path, "rb")
    if not raw then
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo leer el snapshot local.",
            detail = read_error,
        }
    end

    local ok, envelope = pcall(json.decode, raw)
    if not ok or type(envelope) ~= "table" or type(envelope.snapshot) ~= "table" then
        return nil, {
            code = "INVALID_SNAPSHOT",
            message = "El snapshot local no es válido.",
        }
    end

    local snapshot, map_error = SnapshotMapper.map(envelope.snapshot)
    if not snapshot then
        return nil, map_error
    end

    return {
        snapshot = snapshot,
        metadata = type(envelope.metadata) == "table" and envelope.metadata or {},
    }
end

function SnapshotStore:save(snapshot, metadata)
    local envelope = {
        snapshot = snapshot,
        metadata = {
            etag = metadata and metadata.etag or nil,
            lastCheckedAt = metadata and metadata.lastCheckedAt or nil,
            requestKey = metadata and metadata.requestKey or nil,
        },
    }
    local encoded, encode_error = encode(envelope)
    if not encoded then
        return nil, encode_error
    end

    if #encoded > MAX_JSON_BYTES then
        return nil, {
            code = "SNAPSHOT_TOO_LARGE",
            message = "El snapshot supera el límite permitido de 1 MiB.",
        }
    end

    local ok, path_error = util.makePath(self.dataDir)
    if not ok then
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo preparar el almacenamiento local.",
            detail = path_error,
        }
    end

    local written, write_error = util.writeToFile(encoded, self.temporaryPath, true, false)
    if not written then
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo escribir el snapshot local.",
            detail = write_error,
        }
    end

    local renamed, rename_error = os.rename(self.temporaryPath, self.path)
    if not renamed then
        os.remove(self.temporaryPath)
        return nil, {
            code = "STORE_ERROR",
            message = "No se pudo finalizar el snapshot local.",
            detail = rename_error,
        }
    end

    return true
end

function SnapshotStore:clear()
    os.remove(self.path)
    os.remove(self.temporaryPath)
end

function SnapshotStore:getPath()
    return self.path
end

return SnapshotStore
