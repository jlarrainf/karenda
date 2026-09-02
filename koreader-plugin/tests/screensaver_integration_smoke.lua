local pluginPath = assert(arg[1], "Se requiere la ruta de karenda.koplugin.")
package.path = pluginPath .. "/?.lua;" .. package.path

local function stub(name, value)
    package.loaded[name] = value
end

stub("gettext", function(value)
    return value
end)
stub("ffi/blitbuffer", { COLOR_WHITE = "white" })
stub("logger", {
    warn = function() end,
})

local Device = {
    screen_saver_mode = false,
    orig_rotation_mode = nil,
    screen = {
        getWidth = function()
            return 600
        end,
        getHeight = function()
            return 800
        end,
        clear = function(self)
            self.clear_count = (self.clear_count or 0) + 1
        end,
        refreshFull = function(self, x, y, width, height)
            self.refresh_count = (self.refresh_count or 0) + 1
            self.last_refresh = { x = x, y = y, w = width, h = height }
        end,
    },
    hasEinkScreen = function()
        return true
    end,
    isEmulator = function()
        return false
    end,
    isTouchDevice = function()
        return true
    end,
}
stub("device", Device)

local ScreenSaverWidget = {}
function ScreenSaverWidget:new(values)
    return { kind = "screen_saver", values = values }
end
stub("ui/widget/screensaverwidget", ScreenSaverWidget)

local ScreenSaverLockWidget = {}
function ScreenSaverLockWidget:new(values)
    return { kind = "screen_saver_lock", values = values }
end
stub("ui/widget/screensaverlockwidget", ScreenSaverLockWidget)

local shown = {}
local UIManager = {
    ignore_touch_input = nil,
}
function UIManager:setIgnoreTouchInput(value)
    self.ignore_touch_input = value
end
function UIManager:show(widget, mode)
    table.insert(shown, { widget = widget, mode = mode })
end
stub("ui/uimanager", UIManager)

local originalCalls = 0
local Screensaver = {}
function Screensaver.show(instance)
    originalCalls = originalCalls + 1
    if instance.expect_as_is then
        assert(instance.screensaver_type == "disable")
        assert(instance.show_message == false)
        assert(instance.overlay_message == nil)
    end
    return "delegated"
end
stub("ui/screensaver", Screensaver)

local function wrapMethod(target, field, newFunction)
    local wrapped = {
        target_table = target,
        old_func = target[field],
        func = newFunction,
    }
    function wrapped:raw_call(...)
        return self.old_func(...)
    end
    function wrapped:raw_method_call(...)
        return self:raw_call(self.target_table, ...)
    end
    target[field] = setmetatable(wrapped, {
        __call = function(self, ...)
            return self.func(...)
        end,
    })
    return target[field]
end
stub("util", { wrapMethod = wrapMethod })

local bookWidget = { kind = "karenda_book_screensaver" }
stub("book_screensaver", {
    canShow = function(ui)
        return ui and ui.document ~= nil
    end,
    build = function()
        return bookWidget
    end,
})

G_reader_settings = {
    karenda_screensaver_enabled = false,
    isTrue = function(self, name)
        return self[name] == true
    end,
    saveSetting = function(self, name, value)
        self[name] = value
    end,
    readSetting = function(self, name)
        if name == "screensaver_delay" then
            return "gesture"
        end
        return self[name]
    end,
}

local Runtime = require("runtime")
Runtime.clearContext()
local Integration = require("screensaver_integration")

local firstWrapper = assert(Integration.ensureInstalled())
assert(firstWrapper == Screensaver.show)
assert(Integration.ensureInstalled() == firstWrapper)
assert(firstWrapper.karenda_screensaver_wrapper)
assert(type(firstWrapper.raw_call) == "function")

local instance = {
    ui = { document = nil },
    screensaver_type = "custom",
    show_message = true,
    overlay_message = "mensaje",
}

local delegated = Screensaver.show(instance)
assert(delegated == "delegated")
assert(originalCalls == 1)

Runtime.setContext("calendar")
instance.expect_as_is = nil
instance.screensaver_type = "kobo_style"
instance.show_message = true
instance.overlay_message = "evento"
delegated = Screensaver.show(instance)
assert(delegated == "delegated")
assert(originalCalls == 2)
assert(instance.screensaver_type == "kobo_style")
assert(instance.show_message == true)
assert(instance.overlay_message == "evento")

G_reader_settings.karenda_screensaver_enabled = true
instance.expect_as_is = true
local refreshesBeforeAsIs = Device.screen.refresh_count or 0
delegated = Screensaver.show(instance)
assert(delegated == "delegated")
assert(originalCalls == 3)
assert(instance.screensaver_type == "kobo_style")
assert(instance.show_message == true)
assert(instance.overlay_message == "evento")
assert((Device.screen.refresh_count or 0) == refreshesBeforeAsIs)

Runtime.clearContext()
instance.ui.document = { file = "book.epub" }
instance.expect_as_is = nil
local beforeBook = originalCalls
Screensaver.show(instance)
assert(originalCalls == beforeBook)
assert(Device.screen_saver_mode)
assert(Device.screen.clear_count == 1)
assert(Device.screen.refresh_count == 1)
assert(Device.screen.last_refresh.w == 600)
assert(Device.screen.last_refresh.h == 800)
assert(#shown == 2)
assert(shown[1].widget.kind == "screen_saver")
assert(shown[2].widget.kind == "screen_saver_lock")
assert(shown[1].widget.values.widget == bookWidget)

local externalCalls = 0
Screensaver.show = function(instance)
    externalCalls = externalCalls + 1
    if instance.screensaver_type == "kobo_style" then
        return "external_kobo"
    end
    return "external_fallback"
end
local coexistWrapper = Integration.ensureInstalled()
assert(coexistWrapper ~= firstWrapper)

Runtime.setContext("note")
instance.expect_as_is = nil
instance.screensaver_type = "custom"
local coexistResult = Screensaver.show(instance)
assert(coexistResult == "external_fallback")
assert(externalCalls == 1)
assert(instance.screensaver_type == "custom")

Runtime.clearContext()
local shownBeforeCoexistBook = #shown
Screensaver.show(instance)
assert(externalCalls == 1)
assert(#shown == shownBeforeCoexistBook + 2)

print("screensaver_integration_smoke: OK")
