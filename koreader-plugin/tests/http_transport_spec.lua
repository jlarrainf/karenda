package.path = "../karenda.koplugin/?.lua;" .. package.path

local mocked_modules = {
    "ui/uimanager",
    "ltn12",
    "socket",
    "socket.http",
    "socketutil",
    "http_transport",
}

local original_loaded = {}
local original_preload = {}
for _, module_name in ipairs(mocked_modules) do
    original_loaded[module_name] = package.loaded[module_name]
    original_preload[module_name] = package.preload[module_name]
end

local function restoreModules()
    for _, module_name in ipairs(mocked_modules) do
        package.loaded[module_name] = original_loaded[module_name]
        package.preload[module_name] = original_preload[module_name]
    end
end

describe("http_transport", function()
    after_each(restoreModules)

    it("uses the UI tick when Turbo I/O is unavailable", function()
        local ui_manager = {
            looper = nil,
            next_tick_calls = 0,
        }
        function ui_manager:initLooper() end
        function ui_manager:nextTick(action)
            self.next_tick_calls = self.next_tick_calls + 1
            action()
        end
        function ui_manager:setInputTimeout() end
        function ui_manager:resetInputTimeout() end

        local captured_request
        local socket_http = {}
        function socket_http.request(request)
            captured_request = request
            return 1, 401, {}, "Unauthorized"
        end

        package.loaded["ui/uimanager"] = nil
        package.loaded["ltn12"] = nil
        package.loaded["socket"] = nil
        package.loaded["socket.http"] = nil
        package.loaded["socketutil"] = nil
        package.loaded["http_transport"] = nil
        package.preload["ui/uimanager"] = function() return ui_manager end
        package.preload["ltn12"] = function()
            return {
                sink = {
                    table = function()
                        return function() return 1 end
                    end,
                },
                source = {
                    string = function(body) return body end,
                },
            }
        end
        package.preload["socket"] = function()
            return {
                skip = function(count, ...)
                    return select(count + 1, ...)
                end,
            }
        end
        package.preload["socket.http"] = function() return socket_http end
        package.preload["socketutil"] = function()
            return {
                set_timeout = function() end,
                reset_timeout = function() end,
            }
        end

        local HttpTransport = require("http_transport")
        local response
        HttpTransport:new():request({
            url = "https://example.invalid/device-tokens",
            method = "POST",
            body = "{\"action\":\"pair\"}",
        }, function(result)
            response = result
        end)

        assert.are.equal(1, ui_manager.next_tick_calls)
        assert.are.equal(401, response.status)
        assert.are.equal("POST", captured_request.method)
        assert.are.equal("{\"action\":\"pair\"}", captured_request.source)
    end)
end)
