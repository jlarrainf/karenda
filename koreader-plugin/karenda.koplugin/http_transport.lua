local UIManager = require("ui/uimanager")

local HttpTransport = {}
HttpTransport.__index = HttpTransport

local function requestWithTurbo(transport, request, response_callback)
    UIManager.looper:add_callback(function()
        UIManager:setInputTimeout()
        local turbo = require("turbo")
        local client = turbo.async.HTTPClient({ verify_ca = transport.verifyCa })
        local response = coroutine.yield(client:fetch(request.url, {
            method = request.method or "GET",
            headers = request.headers,
            body = request.body,
            allow_redirects = false,
        }))
        UIManager:resetInputTimeout()
        response_callback(response)
    end)
end

local function requestWithLuaSocket(request, response_callback)
    UIManager:nextTick(function()
        local ltn12 = require("ltn12")
        local socket = require("socket")
        local http = require("socket.http")
        local socketutil = require("socketutil")
        local response_body = {}
        local request_options = {
            url = request.url,
            method = request.method or "GET",
            headers = request.headers,
            sink = ltn12.sink.table(response_body),
            redirect = false,
        }

        if request.body then
            request_options.source = ltn12.source.string(request.body)
        end

        UIManager:setInputTimeout()
        socketutil:set_timeout(10, 20)
        local call_ok, status_code, headers, status = pcall(function()
            return socket.skip(1, http.request(request_options))
        end)
        socketutil:reset_timeout()
        UIManager:resetInputTimeout()

        if not call_ok then
            response_callback({
                status = 0,
                error_code = "NETWORK_ERROR",
            })
            return
        end

        response_callback({
            status = tonumber(status_code) or 0,
            headers = headers or {},
            body = table.concat(response_body),
            error = status,
        })
    end)
end

function HttpTransport:new(options)
    options = options or {}
    return setmetatable({
        verifyCa = options.verifyCa ~= false,
    }, self)
end

function HttpTransport:request(request, response_callback)
    if type(request.url) ~= "string" or not request.url:match("^https://") then
        response_callback({
            status = 0,
            error_code = "INSECURE_URL",
        })
        return
    end

    UIManager:initLooper()
    if UIManager.looper then
        requestWithTurbo(self, request, response_callback)
        return
    end

    requestWithLuaSocket(request, response_callback)
end

return HttpTransport
