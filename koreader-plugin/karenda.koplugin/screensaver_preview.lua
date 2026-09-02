local Device = require("device")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local InputContainer = require("ui/widget/container/inputcontainer")
local UIManager = require("ui/uimanager")
local FrameContainer = require("ui/widget/container/framecontainer")
local BookScreensaver = require("book_screensaver")

local Screen = Device.screen

local PreviewWidget = InputContainer:extend{
    name = "KarendaScreensaverPreview",
    modal = true,
    invisible = false,
}

function PreviewWidget:init()
    local screen_width = Screen:getWidth()
    local screen_height = Screen:getHeight()

    self[1] = FrameContainer:new{
        width = screen_width,
        height = screen_height,
        bordersize = 0,
        padding = 0,
        background = nil,
        self.widget,
    }

    self.ges_events.ClosePreview = {
        GestureRange:new{
            ges = "tap",
            range = Geom:new{ x = 0, y = 0, w = screen_width, h = screen_height },
        },
    }
    if Device:hasKeys() then
        self.key_events.AnyKeyPressed = { { Device.input.group.Any } }
    end
end

function PreviewWidget:closePreview()
    if self._closing then
        return true
    end

    self._closing = true
    UIManager:close(self)
    if self._previous_input_gestures_disabled then
        UIManager:setIgnoreTouchInput(true)
    end
    return true
end

PreviewWidget.onClosePreview = PreviewWidget.closePreview
PreviewWidget.onAnyKeyPressed = PreviewWidget.closePreview

function PreviewWidget:onCloseWidget()
    UIManager:setDirty(nil, "full")
end

local ScreensaverPreview = {}

function ScreensaverPreview.show(ui)
    local widget = BookScreensaver.build(ui, { preview = true })
    if not widget then
        return false
    end

    local preview = PreviewWidget:new{ widget = widget }
    preview._previous_input_gestures_disabled = UIManager._input_gestures_disabled == true
    UIManager:setIgnoreTouchInput(false)
    UIManager:show(preview, "full")
    return preview
end

return ScreensaverPreview
