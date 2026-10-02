package.path = "../karenda.koplugin/?.lua;" .. package.path

local StatisticsCollector = require("statistics_collector")

describe("statistics_collector", function()
    it("groups daily pages and duration and detects each completed book once", function()
        local connection = {
            exec = function(_, sql)
                if sql:find("strftime", 1, true) then
                    return {
                        dates = { "2026-09-08" },
                        pages = { 3 },
                        durations = { 3600 },
                    }
                end
                return {
                    id_book = { 7, 7, 7, 7 },
                    page = { 1, 2, 3, 4 },
                    start_time = {
                        os.time{ year = 2026, month = 9, day = 8, hour = 9 },
                        os.time{ year = 2026, month = 9, day = 8, hour = 10 },
                        os.time{ year = 2026, month = 9, day = 8, hour = 11 },
                        os.time{ year = 2026, month = 9, day = 8, hour = 12 },
                    },
                    pages = { 4, 4, 4, 4 },
                }
            end,
            close = function() end,
        }
        local collector = StatisticsCollector:new{
            fileExists = function() return true end,
            open = function() return connection end,
        }

        local result = assert(collector:getDailyStats("2026-09-01", "2026-09-30"))
        assert.are.equal(3, result["2026-09-08"].pages)
        assert.are.equal(60, result["2026-09-08"].minutes)
        assert.are.equal(1, result["2026-09-08"].books)
    end)
end)
