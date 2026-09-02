package.path = "../karenda.koplugin/?.lua;" .. package.path

local json = require("json")

local MockTransport = require("mock_transport")
local PairingClient = require("pairing_client")

local function pairedResponse()
    return {
        status = 201,
        headers = {},
        body = json.encode{
            token = "opaque-device-token",
            token_metadata = {
                id = "device-1",
                label = "Kindle de estudio",
                scopes = { "read:snapshot" },
            },
        },
    }
end

describe("pairing_client", function()
    it("canjea el código en el body y no envía una sesión web", function()
        local transport = MockTransport:new(pairedResponse())
        local client = PairingClient:new{ transport = transport }
        local result

        client:pair(
            "https://5zz5dxgt.function2.insforge.app/karenda-koreader-device-tokens",
            "042731",
            function(response)
                result = response
            end
        )

        local request = transport.requests[1]
        local body = json.decode(request.body)
        assert.are.equal("paired", result.kind)
        assert.are.equal("opaque-device-token", result.token)
        assert.are.equal("POST", request.method)
        assert.are.equal("pair", body.action)
        assert.are.equal("042731", body.code)
        assert.is_nil(request.headers.Authorization)
    end)

    it("rechaza códigos inválidos antes de abrir la red", function()
        local transport = MockTransport:new(pairedResponse())
        local client = PairingClient:new{ transport = transport }
        local result

        client:pair("http://example.invalid/pair", "12345", function(response)
            result = response
        end)

        assert.are.equal("error", result.kind)
        assert.are.equal("INSECURE_URL", result.code)
        assert.are.equal(0, #transport.requests)
    end)

    it("traduce expiración y rate limit sin revelar el código", function()
        local transport = MockTransport:new{ status = 401, headers = {} }
        local client = PairingClient:new{ transport = transport }
        local result

        client:pair("https://example.invalid/pair", "042731", function(response)
            result = response
        end)
        assert.are.equal("PAIRING_CODE_INVALID", result.code)
        assert.is_nil(result.message:find("042731", 1, false))

        transport:setResponse{ status = 429, headers = {} }
        client:pair("https://example.invalid/pair", "042731", function(response)
            result = response
        end)
        assert.are.equal("RATE_LIMITED", result.code)
    end)
end)
