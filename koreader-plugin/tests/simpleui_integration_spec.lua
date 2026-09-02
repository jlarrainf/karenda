package.path = "../karenda.koplugin/?.lua;" .. package.path

local Integration = require("simpleui_integration")

describe("simpleui_integration", function()
    it("expone las acciones estables de calendario y notas", function()
        local definitions = Integration.getActionDefinitions()

        assert.are.equal(2, #definitions)
        assert.are.equal("karenda_calendar", definitions[1].id)
        assert.are.equal("Calendario", definitions[1].label)
        assert.are.equal("openCalendar", definitions[1].method)
        assert.are.equal("karenda_notes", definitions[2].id)
        assert.are.equal("Notas", definitions[2].label)
        assert.are.equal("openNotes", definitions[2].method)
    end)

    it("registra acciones y las dirige a la instancia del plugin", function()
        local previous_qa = package.loaded["features/sui_quickactions"]
        local previous_config = package.loaded["infra/sui_config"]
        local descriptors = {}
        local invalidated = false
        package.loaded["features/sui_quickactions"] = {
            register = function(descriptor)
                descriptors[descriptor.id] = descriptor
            end,
            isRegistered = function(id)
                return descriptors[id] ~= nil
            end,
            unregister = function(id)
                descriptors[id] = nil
            end,
        }
        package.loaded["infra/sui_config"] = {
            invalidateTabsCache = function()
                invalidated = true
            end,
        }

        local calendar_opened = false
        local notes_opened = false
        local plugin = {
            openCalendar = function()
                calendar_opened = true
            end,
            openNotes = function()
                notes_opened = true
            end,
        }

        assert.is_true(Integration.register(plugin))
        descriptors.karenda_calendar.execute({})
        descriptors.karenda_notes.execute({})
        assert.is_true(calendar_opened)
        assert.is_true(notes_opened)
        assert.is_true(invalidated)
        assert.is_true(descriptors.karenda_calendar.is_in_place)
        assert.is_true(descriptors.karenda_calendar.is_async_in_place)
        assert.is_true(descriptors.karenda_notes.is_in_place)
        assert.is_true(descriptors.karenda_notes.is_async_in_place)

        package.loaded["features/sui_quickactions"] = previous_qa
        package.loaded["infra/sui_config"] = previous_config
    end)
end)
