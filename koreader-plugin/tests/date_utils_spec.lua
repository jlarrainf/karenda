package.path = "../karenda.koplugin/?.lua;" .. package.path

local DateUtils = require("date_utils")

describe("date_utils", function()
    it("calcula la ventana predeterminada con un reloj controlado", function()
        local values, err = DateUtils.resolveWindow({
            timezone = "America/Santiago",
        }, os.time{
            year = 2026,
            month = 8,
            day = 30,
        })

        assert.is_nil(err)
        assert.are.equal("2026-08-23", values.from)
        assert.are.equal("2027-02-26", values.to)
    end)

    it("rechaza una ventana invertida", function()
        local values, err = DateUtils.resolveWindow({
            timezone = "America/Santiago",
            fromDate = "2026-09-02",
            toDate = "2026-09-01",
        })

        assert.is_nil(values)
        assert.are.equal("INVALID_REQUEST", err.code)
    end)

    it("calcula un retraso positivo hasta el siguiente día", function()
        local delay = DateUtils.secondsUntilNextDay(os.time{
            year = 2026,
            month = 8,
            day = 31,
            hour = 23,
            min = 59,
            sec = 30,
        })

        assert.is_true(delay >= 1)
        assert.is_true(delay <= 86400)
    end)

    it("calcula diferencias de días civiles sin depender de la hora local", function()
        assert.are.equal(2, DateUtils.daysBetween("2026-08-31", "2026-09-02"))
        assert.are.equal(-2, DateUtils.daysBetween("2026-09-02", "2026-08-31"))
        assert.are.equal(2, DateUtils.daysBetween("2028-02-28", "2028-03-01"))
        assert.is_nil(DateUtils.daysBetween("2026-02-30", "2026-03-01"))
    end)
end)
