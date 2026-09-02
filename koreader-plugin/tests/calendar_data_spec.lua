package.path = "../karenda.koplugin/?.lua;" .. package.path

local CalendarData = require("calendar_data")

local function snapshot()
    return {
        window = {
            from = "2026-08-23",
            to = "2026-09-15",
        },
        events = {
            {
                id = "crossing",
                title = "Entrega extendida",
                startAt = "2026-08-31",
                endAt = "2026-09-02",
                allDay = true,
            },
            {
                id = "timed",
                title = "Control",
                startAt = "2026-09-04T13:00:00Z",
                endAt = "2026-09-04T15:00:00Z",
                allDay = false,
            },
            {
                id = "later",
                title = "Cita",
                startAt = "2026-09-08",
                endAt = "2026-09-08",
                allDay = true,
            },
        },
    }
end

describe("calendar_data", function()
    it("calcula periodos mensuales, semanales, diarios y de agenda", function()
        local month = CalendarData.period("month", "2026-09-14", "2026-10-15")
        assert.are.equal("2026-09-01", month.from)
        assert.are.equal("2026-10-01", month.to)
        assert.are.equal("septiembre de 2026", CalendarData.periodLabel("month", month.from))

        local week = CalendarData.period("week", "2026-09-04", "2026-10-15")
        assert.are.equal("2026-08-31", week.from)
        assert.are.equal("2026-09-07", week.to)
        assert.are.equal("Semana del 31/08 al 06/09", CalendarData.periodLabel("week", week.from))

        local day = CalendarData.period("day", "2026-09-04", "2026-10-15")
        assert.are.equal("2026-09-05", day.to)

        local agenda = CalendarData.period("agenda", "2026-09-04", "2026-09-15")
        assert.are.equal("2026-09-15", agenda.to)
    end)

    it("desplaza cada modo con su unidad natural", function()
        assert.are.equal("2027-01-01", CalendarData.shift("month", "2026-12-01", 1))
        assert.are.equal("2028-02-29", CalendarData.shift("day", "2028-02-28", 1))
        assert.are.equal("2026-09-07", CalendarData.shift("week", "2026-08-31", 1))
        assert.are.equal("2026-09-11", CalendarData.shift("agenda", "2026-09-04", 1))
    end)

    it("incluye eventos que atraviesan el límite del periodo y los ordena", function()
        local values = snapshot()
        local period = {
            from = "2026-09-01",
            to = "2026-09-05",
        }
        local events = CalendarData.filterEvents(values.events, period)

        assert.are.equal(2, #events)
        assert.are.equal("crossing", events[1].id)
        assert.are.equal("timed", events[2].id)

        local groups = CalendarData.groupEvents(events, period, true)
        assert.are.equal(4, #groups)
        assert.are.equal("2026-09-01", groups[1].date)
        assert.are.equal(1, #groups[1].events)
        assert.are.equal("2026-09-04", groups[4].date)
        assert.are.equal(1, #groups[4].events)
    end)

    it("recorta la ventana visible y elige un cursor útil", function()
        local values = snapshot()
        local month = CalendarData.period("month", "2026-09-01", values.window.to)
        local visible = CalendarData.clipPeriod(month, values.window)

        assert.are.equal("2026-09-01", visible.from)
        assert.are.equal("2026-09-15", visible.to)
        assert.is_false(CalendarData.isPeriodCovered(month, values.window))
        assert.are.equal("2026-08-31", CalendarData.initialCursor(values, "2026-10-01"))

        local outside = CalendarData.period("day", "2026-09-20", values.window.to)
        assert.is_nil(CalendarData.clipPeriod(outside, values.window))
        assert.are.same({}, CalendarData.eventsForPeriod(values, "day", "2026-09-20").events)
    end)

    it("construye una cuadrícula mensual con siete columnas y conteos diarios", function()
        local values = snapshot()
        local period = CalendarData.period("month", "2026-09-14", "2026-10-15")
        local visible = CalendarData.clipPeriod(period, values.window)
        local rows = CalendarData.monthGrid(period, values.events, visible)

        assert.are.equal(5, #rows)
        assert.are.equal(7, #rows[1])
        assert.are.equal("2026-08-31", rows[1][1].date)
        assert.is_false(rows[1][1].inPeriod)
        assert.are.equal("2026-09-01", rows[1][2].date)
        assert.are.equal(1, rows[1][2].count)
        assert.are.equal(1, rows[1][3].count)
        assert.are.equal(1, rows[1][5].count)
        assert.is_false(rows[5][7].inPeriod)
    end)

    it("construye la cuadrícula semanal y cuenta eventos de varios días", function()
        local values = snapshot()
        local period = CalendarData.period("week", "2026-09-04", values.window.to)
        local visible = CalendarData.clipPeriod(period, values.window)
        local rows = CalendarData.weekGrid(period, values.events, visible)

        assert.are.equal(1, #rows)
        assert.are.equal(7, #rows[1])
        assert.are.equal("2026-08-31", rows[1][1].date)
        assert.are.equal(1, rows[1][1].count)
        assert.are.equal(1, rows[1][2].count)
        assert.are.equal(1, rows[1][3].count)
        assert.are.equal(1, rows[1][5].count)
    end)

    it("selecciona próximos eventos sin perder los que atraviesan la referencia", function()
        local values = snapshot()
        local period = CalendarData.period("month", "2026-09-04", values.window.to)
        local visible = CalendarData.clipPeriod(period, values.window)
        local events = CalendarData.filterEvents(values.events, visible)

        local preview, total = CalendarData.previewEvents(events, visible, "2026-09-01", 2)
        assert.are.equal(2, #preview)
        assert.are.equal(3, total)
        assert.are.equal("crossing", preview[1].id)
        assert.are.equal("timed", preview[2].id)

        local later, later_total = CalendarData.previewEvents(events, visible, "2026-09-03", 4)
        assert.are.equal(2, later_total)
        assert.are.equal("timed", later[1].id)
        assert.are.equal("later", later[2].id)
        assert.are.equal("Mar 08/09", CalendarData.compactDayLabel("2026-09-08"))
        assert.are.equal(
            "Martes 08 de septiembre de 2026",
            CalendarData.fullDayLabel("2026-09-08")
        )
    end)

    it("trata la medianoche final de un evento con hora como límite exclusivo", function()
        local event = {
            id = "midnight",
            startAt = "2026-09-04T23:00:00-04:00",
            endAt = "2026-09-05T00:00:00-04:00",
            allDay = false,
        }
        assert.are.equal("2026-09-04", CalendarData.eventEndDate(event))
        assert.are.equal(1, #CalendarData.filterEvents({ event }, {
            from = "2026-09-04",
            to = "2026-09-05",
        }))
        assert.are.equal(0, #CalendarData.filterEvents({ event }, {
            from = "2026-09-05",
            to = "2026-09-06",
        }))

        local counts = CalendarData.countEventsByDate({ event }, {
            from = "2026-09-04",
            to = "2026-09-06",
        })
        assert.are.equal(1, counts["2026-09-04"])
        assert.is_nil(counts["2026-09-05"])
    end)

    it("calcula la cuenta regresiva hasta la fecha final del evento", function()
        local crossing = snapshot().events[1]
        assert.are.equal(2, CalendarData.daysRemaining(crossing, "2026-08-31"))
        assert.are.equal(0, CalendarData.daysRemaining(crossing, "2026-09-02"))
        assert.are.equal(-1, CalendarData.daysRemaining(crossing, "2026-09-03"))

        local midnight = {
            startAt = "2026-09-04T23:00:00-04:00",
            endAt = "2026-09-05T00:00:00-04:00",
            allDay = false,
        }
        assert.are.equal(0, CalendarData.daysRemaining(midnight, "2026-09-04"))
    end)
end)
