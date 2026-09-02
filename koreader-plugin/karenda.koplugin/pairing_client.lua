local json = require("json")

local PairingClient = {}
PairingClient.__index = PairingClient

local MAX_RESPONSE_BYTES = 64 * 1024

local ERROR_MESSAGES = {
    BACKEND_UNAVAILABLE = "La vinculación no está disponible.",
    INSECURE_URL = "La URL de vinculación debe usar HTTPS.",
    INVALID_REQUEST = "El código de emparejamiento no es válido.",
    INVALID_RESPONSE = "El servidor devolvió una respuesta no válida.",
    NETWORK_ERROR = "No se pudo conectar con Karenda.",
    PAIRING_CODE_INVALID = "El código no es válido, ya venció o ya fue usado.",
    RATE_LIMITED = "Se alcanzó el límite temporal. Espera un minuto e inténtalo nuevamente.",
}

local function makeFailure(code, status)
    return {
        kind = "error",
        code = code,
        status = status,
        message = ERROR_MESSAGES[code] or ERROR_MESSAGES.BACKEND_UNAVAILABLE,
    }
end

local function statusCode(response)
    return tonumber(response and (response.status or response.status_code or response.code))
end

function PairingClient:new(options)
    options = options or {}
    return setmetatable({
        transport = assert(options.transport, "PairingClient requires a transport"),
    }, self)
end

function PairingClient:pair(url, code, callback)
    if type(callback) ~= "function" then
        return false, makeFailure("INVALID_REQUEST", 400)
    end

    if type(url) ~= "string" or not url:match("^https://") then
        callback(makeFailure("INSECURE_URL", 400))
        return false
    end

    if type(code) ~= "string" or not code:match("^%d%d%d%d%d%d$") then
        callback(makeFailure("INVALID_REQUEST", 400))
        return false
    end

    local ok, body = pcall(json.encode, {
        action = "pair",
        code = code,
    })
    if not ok or type(body) ~= "string" then
        callback(makeFailure("INVALID_REQUEST", 400))
        return false
    end

    self.transport:request({
        url = url,
        method = "POST",
        headers = {
            ["Accept"] = "application/json",
            ["Content-Type"] = "application/json",
        },
        body = body,
        allow_redirects = false,
    }, function(response)
        local status = statusCode(response)
        if not status or status == 0 then
            callback(makeFailure("NETWORK_ERROR", nil))
            return
        end

        if status == 400 then
            callback(makeFailure("INVALID_REQUEST", status))
            return
        elseif status == 401 then
            callback(makeFailure("PAIRING_CODE_INVALID", status))
            return
        elseif status == 429 then
            callback(makeFailure("RATE_LIMITED", status))
            return
        elseif status ~= 201 then
            callback(makeFailure("BACKEND_UNAVAILABLE", status))
            return
        end

        if type(response.body) ~= "string"
            or #response.body == 0
            or #response.body > MAX_RESPONSE_BYTES then
            callback(makeFailure("INVALID_RESPONSE", status))
            return
        end

        local decoded_ok, payload = pcall(json.decode, response.body)
        if not decoded_ok
            or type(payload) ~= "table"
            or type(payload.token) ~= "string"
            or payload.token == ""
            or type(payload.token_metadata) ~= "table" then
            callback(makeFailure("INVALID_RESPONSE", status))
            return
        end

        callback({
            kind = "paired",
            token = payload.token,
            metadata = payload.token_metadata,
            message = "Dispositivo vinculado.",
            status = status,
        })
    end)

    return true
end

return PairingClient
