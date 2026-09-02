local pluginPath = assert(arg[1], "Se requiere la ruta de karenda.koplugin.")
package.path = pluginPath .. "/?.lua;" .. package.path

require("setupkoenv")

local Integration = require("simpleui_integration")
local descriptors = {}
local indicator_events = {}
local previous_bottombar = package.loaded["screens/sui_bottombar"]
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
    invalidateTabsCache = function() end,
}
package.loaded["screens/sui_bottombar"] = {
    setTempTabActive = function(_, action_id, active, previous_action)
        indicator_events[#indicator_events + 1] = {
            action_id = action_id,
            active = active,
            previous_action = previous_action,
        }
    end,
}

local opened = {}
local forwarded_simpleui_plugin
local forwarded_fm
local plugin = {
    openCalendar = function(_, simpleui_plugin, fm)
        opened[#opened + 1] = "calendar"
        forwarded_simpleui_plugin = simpleui_plugin
        forwarded_fm = fm
    end,
    openNotes = function()
        opened[#opened + 1] = "notes"
    end,
}
local simpleui_plugin = { active_action = "home" }
local fm = { karenda = plugin }

assert(Integration.register(plugin))
for _, id in ipairs({ "karenda_calendar", "karenda_notes" }) do
    assert(descriptors[id])
    assert(descriptors[id].is_in_place)
    assert(descriptors[id].is_async_in_place)
end
descriptors.karenda_calendar.execute({ plugin = simpleui_plugin, fm = fm })
descriptors.karenda_notes.execute({})
assert(opened[1] == "calendar")
assert(opened[2] == "notes")
assert(forwarded_simpleui_plugin == simpleui_plugin)
assert(forwarded_fm == fm)

local view = {
    onCloseWidget = function(self)
        self.closed = true
    end,
}
Integration.trackIndicator(simpleui_plugin, "calendar", view)
assert(indicator_events[1].action_id == "karenda_calendar")
assert(indicator_events[1].active)
simpleui_plugin.active_action = "history"
view:onCloseWidget()
assert(view.closed)
assert(indicator_events[2].action_id == "karenda_calendar")
assert(not indicator_events[2].active)
assert(indicator_events[2].previous_action == "history")

local handoff_view = {
    navbarNavigationInProgress = true,
    onCloseWidget = function(self)
        self.closed = true
    end,
}
local indicator_count_before_handoff = #indicator_events
Integration.trackIndicator(simpleui_plugin, "note", handoff_view)
assert(#indicator_events == indicator_count_before_handoff + 1)
assert(indicator_events[#indicator_events].action_id == "karenda_notes")
assert(indicator_events[#indicator_events].active)
handoff_view:onCloseWidget()
assert(handoff_view.closed)
assert(#indicator_events == indicator_count_before_handoff + 1)

package.loaded["screens/sui_bottombar"] = previous_bottombar
print("Smoke de Quick Actions overlay: correcto.")
