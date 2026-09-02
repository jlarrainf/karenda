local IconButton = require("ui/widget/iconbutton")
local IconWidget = require("ui/widget/iconwidget")
local Device = require("device")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local Size = require("ui/size")
local UIManager = require("ui/uimanager")

local SurfaceNavigation = {}
local source = (debug.getinfo(1, "S").source or ""):gsub("\\\\", "/")
local plugin_directory = source:match("^@?(.*)/[^/]+$") or "."
local refresh_icon = plugin_directory .. "/icons/refresh.svg"
local Screen = Device.screen

local function isOnWindowStack(widget)
    for _, entry in ipairs(UIManager._window_stack or {}) do
        if entry and entry.widget == widget then
            return true
        end
    end
    return false
end

local function getModernNavbar()
    local ok, Bottombar = pcall(require, "screens/sui_bottombar")
    if not ok or type(Bottombar) ~= "table" or type(Bottombar.TOTAL_H) ~= "function" then
        return nil, 0
    end

    local ok_height, height = pcall(Bottombar.TOTAL_H)
    if not ok_height or type(height) ~= "number" or height <= 0 then
        return nil, 0
    end

    for index = #(UIManager._window_stack or {}), 1, -1 do
        local entry = UIManager._window_stack[index]
        local widget = entry and entry.widget
        if widget and widget._navbar_bar then
            return widget, height
        end
    end
    return nil, 0
end

local function getLegacyNavbar()
    local FileManager = package.loaded["apps/filemanager/filemanager"]
    local file_manager = FileManager and FileManager.instance
    if not isOnWindowStack(file_manager) then
        return nil, 0
    end
    local frame = file_manager and file_manager[1]
    local group = frame and frame[1]
    local navbar = group and group[2]
    if not navbar or type(navbar.onTapNavBar) ~= "function" or not navbar.getSize then
        return nil, 0
    end

    local size = navbar:getSize()
    return file_manager, size and size.h or 0
end

function SurfaceNavigation.getNavbar()
    local modern_widget, modern_height = getModernNavbar()
    local legacy_widget, legacy_height = getLegacyNavbar()
    if modern_widget then
        return modern_widget, math.max(modern_height, legacy_height)
    end
    if legacy_widget and legacy_height > 0 then
        return legacy_widget, legacy_height
    end
    return nil, 0
end

function SurfaceNavigation.getBottomInset()
    local _, height = SurfaceNavigation.getNavbar()
    return height
end

function SurfaceNavigation.deferCloseOnNavbarTap(view, gesture)
    if not view or view.navbarHeight <= 0
        or not gesture or not gesture.pos
        or gesture.pos.y < Screen:getHeight() - view.navbarHeight
    then
        return false
    end

    if not view.navbarCloseAction then
        local close_action
        close_action = function()
            if view.navbarCloseAction ~= close_action then
                return
            end
            view.navbarCloseAction = nil
            if isOnWindowStack(view) then
                -- The navbar callback has already received the same gesture
                -- by the time this next-tick action runs. Mark this close as
                -- a handoff so the view does not repaint the screen below it
                -- (usually SimpleUI Home) before the selected destination is
                -- painted. The flag is intentionally set immediately before
                -- UIManager:close(), so a normal close that cancels this
                -- pending action keeps its regular cleanup path.
                view.navbarNavigationInProgress = true
                UIManager:close(view)
                view.navbarNavigationInProgress = nil
            end
        end
        view.navbarCloseAction = close_action
        UIManager:nextTick(close_action)
    end
    return true
end

function SurfaceNavigation.cancelDeferredNavbarClose(view)
    if not view or not view.navbarCloseAction then
        return
    end
    UIManager:unschedule(view.navbarCloseAction)
    view.navbarCloseAction = nil
end

local function replaceWithFileIcon(button)
    if not button or not button.horizontal_group then
        return
    end

    local old_icon = button.image
    local file_icon = IconWidget:new{
        file = refresh_icon,
        width = button.width,
        height = button.height,
    }
    button.image = file_icon
    button.horizontal_group[2] = file_icon
    if old_icon and old_icon.free then
        old_icon:free()
    end
    button:update()
end

function SurfaceNavigation.newRefreshButton(options)
    local button = IconButton:new{
        icon = "close",
        width = Size.item.height_default,
        height = Size.item.height_default,
        padding = Size.padding.default,
        callback = options.callback,
        allow_flash = false,
        show_parent = options.view,
    }
    replaceWithFileIcon(button)
    return button
end

function SurfaceNavigation.attachRefreshButton(title_bar, options)
    local refresh_button = SurfaceNavigation.newRefreshButton(options)
    local close_button = title_bar.right_button
    if not close_button then
        refresh_button.overlap_align = "right"
        table.insert(title_bar, refresh_button)
        title_bar.refresh_button = refresh_button
        return refresh_button
    end

    local compact_padding = Size.padding.default
    close_button.padding_top = compact_padding
    close_button.padding_right = compact_padding
    close_button.padding_bottom = compact_padding
    close_button.padding_left = compact_padding
    close_button:update()

    local action_group = HorizontalGroup:new{
        refresh_button,
        HorizontalSpan:new{ width = Size.padding.small },
        close_button,
    }
    action_group.overlap_align = "right"

    for index, child in ipairs(title_bar) do
        if child == close_button then
            title_bar[index] = action_group
            break
        end
    end
    title_bar.refresh_button = refresh_button
    title_bar.action_group = action_group
    return refresh_button
end

return SurfaceNavigation
