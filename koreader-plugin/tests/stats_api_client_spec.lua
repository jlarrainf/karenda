package.path = "../karenda.koplugin/?.lua;" .. package.path

local json = require("json")
local MockTransport = require("mock_transport")
local StatsApiClient = require("stats_api_client")

describe("stats_api_client", function()
    it("uses HTTPS and keeps the device token out of the URL", function()
        local transport = MockTransport:new{
            status = 200,
            body = json.encode{ links = {}, timezone = "UTC" },
            headers = {},
        }
        local client = StatsApiClient:new{ transport = transport }
        local result
        client:getConfig({
            statsUrl = "https://example.invalid/habit-sync",
            deviceToken = "secret-token",
        }, function(value) result = value end)

        assert.are.equal("config", result.kind)
        assert.is_nil(transport.requests[1].url:find("secret%-token", 1, false))
        assert.are.equal("Bearer secret-token", transport.requests[1].headers.Authorization)
    end)
end)
