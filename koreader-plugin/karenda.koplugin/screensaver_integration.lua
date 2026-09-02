local Blitbuffer = require("ffi/blitbuffer")
local Device = require("device")
local Runtime = require("runtime")
local Screensaver = require("ui/screensaver")
local UIManager = require("ui/uimanager")
local ScreensaverConfig = require("screensaver_config")
local BookScreensaver = require("book_screensaver")
local ScreensaverPolicy = require("screensaver_policy")
local logger = require("logger")
local util = require("util")

local ScreensaverIntegration = {
    state = {
        wrapper = nil,
    },
}

local function restoreInstanceFields(instance, fields)
    instance.screensaver_type = fields.screensaver_type
    instance.show_message = fields.show_message
    instance.overlay_message = fields.overlay_message
end

local function callAsIs(instance, wrapper)
    local fields = {
        screensaver_type = instance.screensaver_type,
        show_message = instance.show_message,
        overlay_message = instance.overlay_message,
    }

    -- Screensaver.show's native early return is KOReader's Leave screen as-is mode.
    instance.screensaver_type = "disable"
    instance.show_message = false
    instance.overlay_message = nil

    local traceback = debug and debug.traceback or function(message)
        return message
    end
    local ok, result = xpcall(function()
        return wrapper:raw_call(instance)
    end, traceback)

    restoreInstanceFields(instance, fields)

    if not ok then
        logger.warn("Karenda: falló la delegación del modo de pantalla intacta.")
        error(result)
    end

    return result
end

local function showBook(instance, wrapper)
    local widget = BookScreensaver.build(instance.ui)
    if not widget then
        return wrapper:raw_call(instance)
    end

    Device.screen_saver_mode = true
    Device.orig_rotation_mode = nil
    UIManager:setIgnoreTouchInput(false)

    local with_gesture_lock = Device:isTouchDevice()
        and G_reader_settings:readSetting("screensaver_delay") == "gesture"

    local ScreenSaverWidget = require("ui/widget/screensaverwidget")
    local ScreenSaverLockWidget = require("ui/widget/screensaverlockwidget")
    if with_gesture_lock then
        instance.screensaver_lock_widget = ScreenSaverLockWidget:new{
            ui = instance.ui,
        }
    end

    instance.screensaver_widget = ScreenSaverWidget:new{
        widget = widget,
        background = Blitbuffer.COLOR_WHITE,
        covers_fullscreen = true,
    }
    instance.screensaver_widget.modal = true
    instance.screensaver_widget.dithered = true

    UIManager:show(instance.screensaver_widget, "full")
    if instance.screensaver_lock_widget then
        UIManager:show(instance.screensaver_lock_widget)
    end
end

local function dispatch(instance, wrapper)
    local context = Runtime.getContext()
    local book_available = BookScreensaver.canShow(instance.ui)
    local action = ScreensaverPolicy.resolve(
        context,
        ScreensaverConfig.isEnabled(),
        instance.ui and instance.ui.document ~= nil,
        book_available
    )

    if action == "as_is" then
        return callAsIs(instance, wrapper)
    elseif action == "book" then
        return showBook(instance, wrapper)
    end

    return wrapper:raw_call(instance)
end

function ScreensaverIntegration.ensureInstalled()
    local current = Screensaver.show
    if ScreensaverIntegration.state.wrapper and current == ScreensaverIntegration.state.wrapper then
        return current
    end

    if type(current) == "table" and current.karenda_screensaver_wrapper then
        ScreensaverIntegration.state.wrapper = current
        return current
    end

    if type(util.wrapMethod) ~= "function" then
        logger.warn("Karenda: KOReader no ofrece util.wrapMethod; integración del salvapantallas omitida.")
        return nil
    end

    local wrapper
    wrapper = util.wrapMethod(Screensaver, "show", function(instance)
        return dispatch(instance, wrapper)
    end)
    wrapper.karenda_screensaver_wrapper = true
    ScreensaverIntegration.state.wrapper = wrapper
    return wrapper
end

function ScreensaverIntegration.getWrapper()
    return ScreensaverIntegration.state.wrapper
end

return ScreensaverIntegration
