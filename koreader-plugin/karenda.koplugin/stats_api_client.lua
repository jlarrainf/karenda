local json = require("json")

local StatsApiClient = {}
StatsApiClient.__index = StatsApiClient

local MAX_RESPONSE_BYTES = 64 * 1024

local ERROR_MESSAGES = {
    BACKEND_UNAVAILABLE = "La sincronización de estadísticas no está disponible.",
    INSECURE_URL = "La URL de estadísticas debe usar HTTPS.",
    INSUFFICIENT_SCOPE = "El dispositivo no tiene permiso para sincronizar hábitos.",
    INVALID_RESPONSE = "El servidor devolvió una respuesta de estadísticas no válida.",
    NETWORK_ERROR = "No se pudo conectar con Karenda.",
    UNAUTHORIZED = "El token del dispositivo no es válido o fue revocado.",
}

local function statusCode(response)
    return tonumber(response and (response.status or response.status_code or response.code))
end

local function makeFailure(code, status)
    return {
        kind = "error",
        code = code,
        status = status,
        message = ERROR_MESSAGES[code] or ERROR_MESSAGES.BACKEND_UNAVAILABLE,
    }
end

function StatsApiClient:new(options)
    options = options or {}
    return setmetatable({
        transport = assert(options.transport, "StatsApiClient requires a transport"),
    }, self)
end

function StatsApiClient:request(values, method, body, callback)
    if type(values.statsUrl) ~= "string" or not values.statsUrl:match("^https://") then
        callback(makeFailure("INSECURE_URL", 400))
        return false
    end
    if type(values.deviceToken) ~= "string" or values.deviceToken == "" then
        callback(makeFailure("UNAUTHORIZED", 401))
        return false
    end

    local encoded_body
    if body ~= nil then
        local ok
        ok, encoded_body = pcall(json.encode, body)
        if not ok or type(encoded_body) ~= "string" then
            callback(makeFailure("INVALID_RESPONSE", 400))
            return false
        end
    end

    self.transport:request({
        url = values.statsUrl,
        method = method,
        headers = {
            ["Accept"] = "application/json",
            ["Authorization"] = "Bearer " .. values.deviceToken,
            ["Content-Type"] = "application/json",
        },
        body = encoded_body,
        allow_redirects = false,
    }, function(response)
        local status = statusCode(response)
        if not status or status == 0 then
            callback(makeFailure("NETWORK_ERROR", nil))
            return
        end
        if status ~= 200 then
            local code = status == 401 and "UNAUTHORIZED"
                or status == 403 and "INSUFFICIENT_SCOPE"
                or "BACKEND_UNAVAILABLE"
            callback(makeFailure(code, status))
            return
        end
        if type(response.body) ~= "string" or #response.body == 0 or #response.body > MAX_RESPONSE_BYTES then
            callback(makeFailure("INVALID_RESPONSE", status))
            return
        end

        local ok, payload = pcall(json.decode, response.body)
        if not ok or type(payload) ~= "table" then
            callback(makeFailure("INVALID_RESPONSE", status))
            return
        end
        callback({ kind = "ok", status = status, payload = payload })
    end)
    return true
end

function StatsApiClient:getConfig(values, callback)
    return self:request(values, "GET", nil, function(result)
        if result.kind ~= "ok" or type(result.payload.links) ~= "table" then
            if result.kind == "ok" then result = makeFailure("INVALID_RESPONSE", result.status) end
            callback(result)
            return
        end
        callback({
            kind = "config",
            links = result.payload.links,
            timezone = result.payload.timezone,
        })
    end)
end

function StatsApiClient:sendBatch(values, timezone, observations, callback)
    return self:request(values, "POST", {
        schema_version = 1,
        timezone = timezone,
        observations = observations,
    }, callback)
end

return StatsApiClient
