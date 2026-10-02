package.path = "../karenda.koplugin/?.lua;" .. package.path

local StatsSyncService = require("stats_sync_service")

describe("stats_sync_service", function()
    it("sends the current-year backfill and persists completion", function()
        local state = { pending = {} }
        local sent
        local service = StatsSyncService:new{
            config = {
                load = function()
                    return { deviceToken = "secret-token", timezone = "UTC" }
                end,
            },
            store = {
                load = function() return state end,
                save = function(_, value) state = value; return true end,
            },
            apiClient = {
                getConfig = function(_, _, callback)
                    callback({
                        kind = "config",
                        timezone = "UTC",
                        links = {{
                            id = "link-1",
                            metric_key = "reading_pages",
                            start_date = "2026-01-01",
                            end_date = "2026-09-08",
                        }},
                    })
                    return true
                end,
                sendBatch = function(_, _, _, observations, callback)
                    sent = observations
                    callback({ kind = "ok" })
                    return true
                end,
            },
            collector = {
                getDailyStats = function()
                    return { ["2026-09-08"] = { pages = 12 } }
                end,
            },
            anki = {
                getDailyStats = function() return {} end,
            },
            clock = function() return os.time{ year = 2026, month = 9, day = 9, hour = 12 } end,
        }

        local result
        assert.is_true(service:sync("manual", function(value) result = value end))
        assert.are.equal("updated", result.kind)
        assert.are.equal(1, #sent)
        assert.are.equal("link-1:2026-09-08", sent[1].external_id)
        assert.are.equal(2026, state.backfillYear)
    end)
end)
