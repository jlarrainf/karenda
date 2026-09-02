local DataStorage = require("datastorage")
local LuaSettings = require("luasettings")
local util = require("util")

local Config = {}

local DATA_DIR = DataStorage:getSettingsDir() .. "/karenda"
local SETTINGS_FILE = DATA_DIR .. "/settings.lua"

local DEFAULTS = {
    apiUrl = "https://5zz5dxgt.function2.insforge.app/karenda-koreader-snapshot",
    pairingUrl = "https://5zz5dxgt.function2.insforge.app/karenda-koreader-device-tokens",
    deviceToken = "",
    timezone = "America/Santiago",
    fromDate = nil,
    toDate = nil,
    syncIntervalSeconds = nil,
    lastCheckedAt = nil,
}

local settings

local function getSettings()
    if settings then
        return settings
    end

    local ok, err = util.makePath(DATA_DIR)
    if not ok then
        return nil, err
    end

    settings = LuaSettings:open(SETTINGS_FILE)
    return settings
end

local function readString(store, key, fallback)
    local value = store:readSetting(key)
    if type(value) == "string" then
        return value
    end
    return fallback
end

local function readOptionalString(store, key)
    local value = store:readSetting(key)
    if type(value) == "string" and value ~= "" then
        return value
    end
    return nil
end

local function copyDefaults()
    local values = {}
    for key, value in pairs(DEFAULTS) do
        values[key] = value
    end
    return values
end

function Config.load()
    local store, err = getSettings()
    if not store then
        return copyDefaults(), err
    end

    local values = copyDefaults()
    values.apiUrl = readString(store, "apiUrl", DEFAULTS.apiUrl)
    values.pairingUrl = readString(store, "pairingUrl", DEFAULTS.pairingUrl)
    values.deviceToken = readString(store, "deviceToken", DEFAULTS.deviceToken)
    values.timezone = readString(store, "timezone", DEFAULTS.timezone)
    values.fromDate = readOptionalString(store, "fromDate")
    values.toDate = readOptionalString(store, "toDate")

    local interval = store:readSetting("syncIntervalSeconds")
    if type(interval) == "number" and interval > 0 then
        values.syncIntervalSeconds = interval
    end

    local lastCheckedAt = store:readSetting("lastCheckedAt")
    if type(lastCheckedAt) == "number" and lastCheckedAt >= 0 then
        values.lastCheckedAt = lastCheckedAt
    end

    return values
end

function Config.save(values)
    local store, err = getSettings()
    if not store then
        return nil, err
    end

    local keys = {
        "apiUrl",
        "pairingUrl",
        "deviceToken",
        "timezone",
        "fromDate",
        "toDate",
        "syncIntervalSeconds",
        "lastCheckedAt",
    }

    for _, key in ipairs(keys) do
        if values[key] ~= nil then
            store:saveSetting(key, values[key])
        end
    end

    local ok, flush_err = pcall(function()
        store:flush()
    end)
    if not ok then
        return nil, flush_err
    end

    return true
end

function Config.clearWindow()
    local store, err = getSettings()
    if not store then
        return nil, err
    end

    store:delSetting("fromDate")
    store:delSetting("toDate")
    store:flush()
    return true
end

function Config.getDataDir()
    return DATA_DIR
end

function Config.getSettingsFile()
    return SETTINGS_FILE
end

return Config
