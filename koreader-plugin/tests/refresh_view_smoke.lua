local pluginPath = assert(arg[1], "Se requiere la ruta de karenda.koplugin.")
package.path = pluginPath .. "/?.lua;" .. package.path

require("setupkoenv")
package.path = pluginPath .. "/?.lua;" .. package.path
G_defaults = require("luadefaults"):open()
local DataStorage = require("datastorage")
G_reader_settings = require("luasettings"):open(DataStorage:getDataDir() .. "/settings.reader.lua")
local Device = require("device")
require("document/canvascontext"):init(Device)
require("ui/bidi").setup(G_reader_settings:readSetting("language"))

local UIManager = require("ui/uimanager")
local notification_events = {}
local previousNotification = package.loaded["ui/widget/notification"]
package.loaded["ui/widget/notification"] = {
    SOURCE_ALWAYS_SHOW = 0x8000,
    notify = function(_, text, source)
        notification_events[#notification_events + 1] = {
            text = text,
            source = source,
        }
    end,
}
package.loaded["main"] = nil
local Karenda = require("main")

local shown = {}
local closed = {}
local previousShow = UIManager.show
local previousClose = UIManager.close
UIManager.show = function(_, widget)
    shown[#shown + 1] = widget
end
UIManager.close = function(_, widget)
    closed[#closed + 1] = widget
end

local view = {}
local freshSnapshot = { snapshotId = "fresh" }
local rebuilt = {}
local plugin = {
    activeKarendaView = view,
    sync = function(self, callback)
        callback(self.nextResult)
        return true
    end,
}
local viewModule = {
    show = function(owner, snapshot)
        rebuilt[#rebuilt + 1] = { owner = owner, snapshot = snapshot }
    end,
}

local function refresh(result)
    plugin.nextResult = result
    return Karenda.refreshView(plugin, view, viewModule, "calendario y notas")
end

assert(refresh({ kind = "updated", snapshot = freshSnapshot }))
assert(shown[1].text == "Actualizando calendario y notas…")
assert(#rebuilt == 1)
assert(rebuilt[1].owner == plugin)
assert(rebuilt[1].snapshot == freshSnapshot)
assert(#closed == 1)
assert(notification_events[1].text == "Se actualizaron el calendario y las notas.")
assert(notification_events[1].source == 0x8000)

assert(refresh({
    kind = "not_modified",
    snapshot = freshSnapshot,
}))
assert(shown[2].text == "Actualizando calendario y notas…")
assert(#rebuilt == 2)
assert(#closed == 2)
assert(notification_events[2].text == "El calendario y las notas ya estaban al día.")
assert(notification_events[2].source == 0x8000)

assert(refresh({
    kind = "error",
    message = "No se pudo conectar con Karenda.",
}))
assert(shown[3].text == "Actualizando calendario y notas…")
assert(#rebuilt == 2)
assert(#shown == 4)
assert(shown[4].text:match("Se mantienen los datos locales"))
assert(#notification_events == 2)
assert(plugin.activeKarendaView == view)

local cacheSyncs = 0
local cachedPlugin = {
    getCachedSnapshot = function()
        return { snapshot = freshSnapshot }
    end,
    sync = function()
        cacheSyncs = cacheSyncs + 1
    end,
}
local cachedViewModule = {
    show = function(_, snapshot)
        assert(snapshot == freshSnapshot)
        return "opened-from-cache"
    end,
}
assert(Karenda.openSnapshot(cachedPlugin, cachedViewModule) == "opened-from-cache")
assert(cacheSyncs == 0)

plugin.activeKarendaView = {}
assert(not refresh({ kind = "updated", snapshot = freshSnapshot }))

UIManager.show = previousShow
UIManager.close = previousClose
package.loaded["ui/widget/notification"] = previousNotification
print("Smoke de actualización de vista: correcto.")
