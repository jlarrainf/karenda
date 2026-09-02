package.path = "../karenda.koplugin/?.lua;" .. package.path

local ApiClient = require("api_client")
local json = require("json")
local MockTransport = require("mock_transport")
local SnapshotMapper = require("snapshot_mapper")
local SyncService = require("sync_service")

local function payload()
    return {
        schema_version = 1,
        snapshot_id = "fixture-sync",
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

local function values()
    return {
        apiUrl = "https://example.invalid/snapshot",
        deviceToken = "secret-token",
        timezone = "America/Santiago",
        fromDate = "2026-08-23",
        toDate = "2027-02-26",
    }
end

local function makeService(response, previous)
    local transport = MockTransport:new(response)
    local saved = {}
    local config = values()
    local configStore = {
        load = function()
            return config
        end,
        save = function(update)
            for key, value in pairs(update) do
                config[key] = value
            end
            return true
        end,
    }
    local store = {
        load = function()
            return previous
        end,
        save = function(_, snapshot, metadata)
            saved.snapshot = snapshot
            saved.metadata = metadata
            return true
        end,
    }
    local runtime = {
        beginSync = function()
            return true
        end,
        finishSync = function() end,
    }
    local service = SyncService:new{
        config = configStore,
        store = store,
        apiClient = ApiClient:new{ transport = transport },
        runtime = runtime,
        clock = function()
            return 1700000000
        end,
    }
    return service, transport, saved, config
end

describe("sync_service", function()
    it("guarda y devuelve un snapshot validado ante 200", function()
        local service, transport, saved, config = makeService({
            status = 200,
            headers = { ETag = '"fresh-etag"' },
            body = json.encode(payload()),
        })
        local result

        assert.is_true(service:sync("manual", function(response)
            result = response
        end))

        assert.are.equal("updated", result.kind)
        assert.are.equal("fixture-sync", result.snapshot.snapshotId)
        assert.are.equal('"fresh-etag"', saved.metadata.etag)
        assert.are.equal(1700000000, config.lastCheckedAt)
        assert.is_nil(transport.requests[1].headers["If-None-Match"])
    end)

    it("reconstruye la vista desde la caché ante 304 sin sobrescribirla", function()
        local mapped = assert(SnapshotMapper.map(payload()))
        local previous = {
            snapshot = mapped,
            metadata = {
                requestKey = "https://example.invalid/snapshot|2026-08-23|2027-02-26|America/Santiago",
                etag = '"old-etag"',
            },
        }
        local service, transport, saved, config = makeService({
            status = 304,
            headers = {},
        }, previous)
        local result

        assert.is_true(service:sync("manual", function(response)
            result = response
        end))

        assert.are.equal("not_modified", result.kind)
        assert.are.equal("fixture-sync", result.snapshot.snapshotId)
        assert.is_nil(saved.snapshot)
        assert.are.equal('"old-etag"', transport.requests[1].headers["If-None-Match"])
        assert.are.equal(1700000000, config.lastCheckedAt)
    end)

    it("devuelve el error sin reemplazar la caché ante un fallo de red", function()
        local mapped = assert(SnapshotMapper.map(payload()))
        local previous = {
            snapshot = mapped,
            metadata = {
                requestKey = "https://example.invalid/snapshot|2026-08-23|2027-02-26|America/Santiago",
                etag = '"old-etag"',
            },
        }
        local service, _, saved = makeService({ status = 500, headers = {} }, previous)
        local result

        assert.is_true(service:sync("manual", function(response)
            result = response
        end))

        assert.are.equal("error", result.kind)
        assert.are.equal("BACKEND_UNAVAILABLE", result.code)
        assert.is_nil(saved.snapshot)
    end)
end)
