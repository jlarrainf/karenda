local _ = require("gettext")

local Integration = {}

local registered_instance

local source = (debug.getinfo(1, "S").source or ""):gsub("\\\\", "/")
local plugin_directory = source:match("^@?(.*)/[^/]+$") or "."

local ACTIONS = {
    {
        id = "karenda_calendar",
        label = "Calendario",
        method = "openCalendar",
        icon = "calendar.svg",
    },
    {
        id = "karenda_notes",
        label = "Notas",
        method = "openNotes",
        icon = "notes.svg",
    },
}

local ACTION_ID_BY_KIND = {
    calendar = "karenda_calendar",
    note = "karenda_notes",
}

local function resolvePlugin(ctx, fallback)
    local fm = ctx and ctx.fm
    if fm and fm.karenda then
        return fm.karenda
    end

    local FileManager = package.loaded["apps/filemanager/filemanager"]
    local liveFm = FileManager and FileManager.instance
    if liveFm and liveFm.karenda then
        return liveFm.karenda
    end

    local ReaderUI = package.loaded["apps/reader/readerui"]
    local reader = ReaderUI and ReaderUI.instance
    if reader and reader.karenda then
        return reader.karenda
    end

    return fallback or registered_instance
end

local function resolveSimpleUIPlugin(fm, fallback)
    local ok_qa, QA = pcall(require, "features/sui_quickactions")
    if ok_qa and QA and type(QA.resolveSimpleUIPlugin) == "function" then
        local ok_resolve, plugin = pcall(QA.resolveSimpleUIPlugin, fm)
        if ok_resolve and plugin then
            return plugin
        end
    end

    local FileManager = package.loaded["apps/filemanager/filemanager"]
    local liveFm = FileManager and FileManager.instance
    if liveFm and liveFm._simpleui_plugin then
        return liveFm._simpleui_plugin
    end

    local ReaderUI = package.loaded["apps/reader/readerui"]
    local reader = ReaderUI and ReaderUI.instance
    if reader and reader.simpleui then
        return reader.simpleui
    end

    return fallback
end

local function makeDescriptor(action, fallback)
    return {
        id = action.id,
        label = _(action.label),
        icon = plugin_directory .. "/icons/" .. action.icon,
        is_in_place = true,
        is_async_in_place = true,
        execute = function(ctx)
            local plugin = resolvePlugin(ctx, fallback)
            local method = plugin and plugin[action.method]
            if type(method) == "function" then
                method(plugin, ctx and ctx.plugin, ctx and ctx.fm)
                return
            end

            local showUnavailable = ctx and ctx.show_unavailable
            if showUnavailable then
                showUnavailable("Karenda no está disponible.")
            end
        end,
    }
end

function Integration.resolveSimpleUIPlugin(fm, fallback)
    return resolveSimpleUIPlugin(fm, fallback)
end

function Integration.trackIndicator(simpleui_plugin, kind, view)
    local action_id = ACTION_ID_BY_KIND[kind]
    if not simpleui_plugin or not action_id or not view then
        return view
    end

    local ok_bottombar, Bottombar = pcall(require, "screens/sui_bottombar")
    if not ok_bottombar or not Bottombar
        or type(Bottombar.setTempTabActive) ~= "function"
    then
        return view
    end

    local previous_action = simpleui_plugin.active_action
    local restored = false
    local function restoreIndicator()
        if restored then
            return
        end
        restored = true

        -- A propagated navbar tap may have changed the real active action.
        -- Preserve it instead of restoring the stale tab from before Karenda.
        local restore_action = simpleui_plugin.active_action
        if restore_action == action_id or restore_action == nil then
            restore_action = previous_action
        end
        pcall(function()
            Bottombar.setTempTabActive(
                simpleui_plugin,
                action_id,
                false,
                restore_action
            )
        end)
    end

    local ok_activate = pcall(function()
        Bottombar.setTempTabActive(
            simpleui_plugin,
            action_id,
            true,
            previous_action
        )
    end)
    if not ok_activate then
        return view
    end

    local original_close = view.onCloseWidget
    view.onCloseWidget = function(self_view)
        -- A navbar tap is a handoff to another destination. The destination
        -- will set its own active tab (or replace the temporary Karenda tab),
        -- so restoring the old indicator here would enqueue an unnecessary
        -- repaint of the screen below and could briefly show the stale tab.
        if not self_view.navbarNavigationInProgress then
            restoreIndicator()
        end
        self_view.onCloseWidget = original_close
        if original_close then
            return original_close(self_view)
        end
    end
    return view
end

function Integration.getActionDefinitions()
    local result = {}
    for _, action in ipairs(ACTIONS) do
        result[#result + 1] = {
            id = action.id,
            label = action.label,
            method = action.method,
        }
    end
    return result
end

function Integration.register(plugin)
    registered_instance = plugin or registered_instance

    local ok_qa, QA = pcall(require, "features/sui_quickactions")
    if not ok_qa or not QA or type(QA.register) ~= "function" then
        return false
    end

    for _, action in ipairs(ACTIONS) do
        local descriptor = makeDescriptor(action, plugin)
        if type(QA.isRegistered) == "function"
            and QA.isRegistered(action.id)
            and type(QA.unregister) == "function"
        then
            QA.unregister(action.id)
        end
        QA.register(descriptor)
    end

    local ok_config, SimpleUIConfig = pcall(require, "infra/sui_config")
    if ok_config and SimpleUIConfig
        and type(SimpleUIConfig.invalidateTabsCache) == "function"
    then
        SimpleUIConfig.invalidateTabsCache()
    end

    return true
end

return Integration
