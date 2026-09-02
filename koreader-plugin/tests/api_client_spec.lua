package.path = "../karenda.koplugin/?.lua;" .. package.path

local json = require("json")

local ApiClient = require("api_client")
local MockTransport = require("mock_transport")

local function payload()
    return {
        schema_version = 1,
        snapshot_id = "fixture-1",
        generated_at = "2026-08-30T23:00:00.000Z",
        timezone = "America/Santiago",
        window = {
            from = "2026-08-23",
            to = "2027-02-26",
        },
        subjects = {},
        personal_groups = {},
        events = {},
        notes = {},
    }
end

describe("api_client", function()
    it("construye una URL HTTPS y nunca añade el token a la URL", function()
        local client = ApiClient:new{
            transport = MockTransport:new{},
        }
        local request = client:buildRequest({
            apiUrl = "https://5zz5dxgt.function2.insforge.app/karenda-koreader-snapshot",
            deviceToken = "secret-token",
            timezone = "America/Santiago",
            fromDate = "2026-08-23",
            toDate = "2027-02-26",
        })

        assert.matches("^https://", request.url)
        assert.is_nil(request.url:find("secret%-token", 1, false))
    end)

    it("decodifica una respuesta 200 y conserva el ETag", function()
        local transport = MockTransport:new{
            status = 200,
            headers = { ETag = '"fixture-etag"' },
            body = json.encode(payload()),
        }
        local client = ApiClient:new{ transport = transport }
        local result

        client:fetchSnapshot({
            url = "https://example.invalid/snapshot?from=2026-08-23&to=2027-02-26&timezone=America%2FSantiago",
            deviceToken = "secret-token",
        }, nil, function(response)
            result = response
        end)

        assert.are.equal("snapshot", result.kind)
        assert.are.equal('"fixture-etag"', result.etag)
        assert.are.equal("fixture-1", result.payload.snapshot_id)
        assert.are.equal("Bearer secret-token", transport.requests[1].headers.Authorization)
    end)

    it("convierte 304, 401, 403 y 413 en resultados seguros", function()
        local transport = MockTransport:new{ status = 304, headers = {} }
        local client = ApiClient:new{ transport = transport }
        local result

        client:fetchSnapshot({
            url = "https://example.invalid/snapshot",
            deviceToken = "secret-token",
        }, '"old-etag"', function(response)
            result = response
        end)
        assert.are.equal("not_modified", result.kind)

        for _, status in ipairs({ 401, 403, 413 }) do
            transport:setResponse{ status = status, headers = {} }
            client:fetchSnapshot({
                url = "https://example.invalid/snapshot",
                deviceToken = "secret-token",
            }, nil, function(response)
                result = response
            end)
            assert.are.equal("error", result.kind)
            assert.is_nil(result.message:find("secret%-token", 1, false))
        end
    end)
end)
