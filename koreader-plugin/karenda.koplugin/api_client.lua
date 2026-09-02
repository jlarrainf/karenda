local json = require("json")

local DateUtils = require("date_utils")

local ApiClient = {}
ApiClient.__index = ApiClient

local MAX_JSON_BYTES = 1024 * 1024

local ERROR_MESSAGES = {
    BACKEND_UNAVAILABLE = "La sincronización no está disponible.",
    INSECURE_REDIRECT = "El servidor solicitó una redirección no permitida.",
    INSECURE_URL = "La URL de sincronización debe usar HTTPS.",
    INSUFFICIENT_SCOPE = "El dispositivo no tiene permiso para leer el calendario.",
    INVALID_REQUEST = "La solicitud de sincronización no es válida.",
    INVALID_SNAPSHOT = "El servidor devolvió un snapshot no válido.",
    NETWORK_ERROR = "No se pudo conectar con Karenda.",
    RATE_LIMITED = "Se alcanzó el límite temporal de sincronización.",
    SNAPSHOT_TOO_LARGE = "El snapshot supera el límite permitido de 1 MiB.",
    UNAUTHORIZED = "El token del dispositivo no es válido o fue revocado.",
}

local function urlEncode(value)
    local encoded = tostring(value):gsub("([^%w%-%._~])", function(character)
        return string.format("%%%02X", string.byte(character))
    end)
    return encoded
end

local function getHeader(headers, name)
    if type(headers) ~= "table" then
        return nil
    end

    local expected = string.lower(name)
    for key, value in pairs(headers) do
        if string.lower(key) == expected then
            return value
        end
    end
    return nil
end

local function makeFailure(code, status)
    return {
        kind = "error",
        code = code,
        status = status,
        message = ERROR_MESSAGES[code] or ERROR_MESSAGES.BACKEND_UNAVAILABLE,
    }
end

local function statusCode(response)
    return tonumber(response.status or response.status_code or response.code)
end

function ApiClient:new(options)
    options = options or {}
    return setmetatable({
        transport = assert(options.transport, "ApiClient requires a transport"),
    }, self)
end

function ApiClient:buildRequest(values, now)
    if type(values.apiUrl) ~= "string" or not values.apiUrl:match("^https://") then
        return nil, {
            code = "INSECURE_URL",
            message = ERROR_MESSAGES.INSECURE_URL,
        }
    end

    if values.apiUrl:find("?", 1, true) or values.apiUrl:find("#", 1, true) then
        return nil, {
            code = "INVALID_REQUEST",
            message = ERROR_MESSAGES.INVALID_REQUEST,
        }
    end

    if type(values.deviceToken) ~= "string" or values.deviceToken == "" then
        return nil, {
            code = "UNAUTHORIZED",
            message = ERROR_MESSAGES.UNAUTHORIZED,
        }
    end

    local window, window_error = DateUtils.resolveWindow(values, now)
    if not window then
        return nil, window_error
    end

    local baseUrl = values.apiUrl:gsub("/+$", "")
    local url = string.format(
        "%s?from=%s&to=%s&timezone=%s",
        baseUrl,
        urlEncode(window.from),
        urlEncode(window.to),
        urlEncode(window.timezone)
    )

    return {
        url = url,
        method = "GET",
        deviceToken = values.deviceToken,
        from = window.from,
        to = window.to,
        timezone = window.timezone,
        requestKey = table.concat({ baseUrl, window.from, window.to, window.timezone }, "|"),
    }
end

function ApiClient:fetchSnapshot(request, previous_etag, callback)
    if type(request) ~= "table" or type(callback) ~= "function" then
        return false, makeFailure("INVALID_REQUEST", 400)
    end

    if type(request.url) ~= "string" or not request.url:match("^https://") then
        callback(makeFailure("INSECURE_URL", 400))
        return false
    end

    if type(request.deviceToken) ~= "string" or request.deviceToken == "" then
        callback(makeFailure("UNAUTHORIZED", 401))
        return false
    end

    local headers = {
        ["Accept"] = "application/json",
        ["Authorization"] = "Bearer " .. request.deviceToken,
    }
    if type(previous_etag) == "string" and previous_etag ~= "" then
        headers["If-None-Match"] = previous_etag
    end

    self.transport:request({
        url = request.url,
        method = "GET",
        headers = headers,
        allow_redirects = false,
    }, function(response)
        local status = response and statusCode(response)
        if not status or status == 0 then
            callback(makeFailure("NETWORK_ERROR", nil))
            return
        end

        local etag = getHeader(response.headers, "etag")
        if status == 304 then
            callback({
                kind = "not_modified",
                status = status,
                etag = etag or previous_etag,
            })
            return
        end

        if status ~= 200 then
            local code
            if status == 400 then
                code = "INVALID_REQUEST"
            elseif status == 401 then
                code = "UNAUTHORIZED"
            elseif status == 403 then
                code = "INSUFFICIENT_SCOPE"
            elseif status == 413 then
                code = "SNAPSHOT_TOO_LARGE"
            elseif status == 429 then
                code = "RATE_LIMITED"
            elseif status >= 300 and status < 400 then
                code = "INSECURE_REDIRECT"
            else
                code = "BACKEND_UNAVAILABLE"
            end
            callback(makeFailure(code, status))
            return
        end

        local body = response.body
        if type(body) ~= "string" or #body == 0 then
            callback(makeFailure("INVALID_SNAPSHOT", status))
            return
        end

        if #body > MAX_JSON_BYTES then
            callback(makeFailure("SNAPSHOT_TOO_LARGE", status))
            return
        end

        local ok, payload = pcall(json.decode, body)
        if not ok or type(payload) ~= "table" then
            callback(makeFailure("INVALID_SNAPSHOT", status))
            return
        end

        callback({
            kind = "snapshot",
            status = status,
            payload = payload,
            etag = etag,
        })
    end)

    return true
end

return ApiClient
