package.path = "../karenda.koplugin/?.lua;" .. package.path

local AnkiStatsAdapter = require("anki_stats_adapter")

describe("anki_stats_adapter", function()
    it("normalizes reviewed cards from the optional provider", function()
        local adapter = AnkiStatsAdapter:new{
            provider = {
                getDailyStats = function()
                    return {
                        ["2026-09-08"] = { reviewed = 24 },
                    }
                end,
            },
        }
        local result = assert(adapter:getDailyStats("2026-09-01", "2026-09-30", "UTC"))
        assert.are.equal(24, result["2026-09-08"].reviewed)
    end)

    it("reports absence instead of manufacturing zeroes", function()
        local adapter = AnkiStatsAdapter:new{ provider = false }
        local result, error = adapter:getDailyStats("2026-09-01", "2026-09-30", "UTC")
        assert.is_nil(result)
        assert.are.equal("ANKI_UNAVAILABLE", error.code)
    end)

    it("accepts providers implemented with a colon method", function()
        local adapter = AnkiStatsAdapter:new{
            provider = {
                getDailyStats = function(self)
                    assert.is_table(self)
                    return { ["2026-09-08"] = { reviewed = 12 } }
                end,
            },
        }
        local result = assert(adapter:getDailyStats("2026-09-01", "2026-09-30", "UTC"))
        assert.are.equal(12, result["2026-09-08"].reviewed)
    end)
end)
