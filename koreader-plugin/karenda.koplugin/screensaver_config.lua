local gettext = require("gettext")

local ScreensaverConfig = {
    setting = "karenda_screensaver_enabled",
    menu_marker = "karenda_screensaver_menu_item",
    visual_settings = {
        show_title = "karenda_screensaver_show_title",
        show_author = "karenda_screensaver_show_author",
        show_chapter = "karenda_screensaver_show_chapter",
        show_progress = "karenda_screensaver_show_progress",
        show_chapter_progress = "karenda_screensaver_show_chapter_progress",
        show_page = "karenda_screensaver_show_page",
        show_pages_left_chapter = "karenda_screensaver_show_pages_left_chapter",
        show_pages_left_book = "karenda_screensaver_show_pages_left_book",
        show_time = "karenda_screensaver_show_time",
        show_time_left_chapter = "karenda_screensaver_show_time_left_chapter",
        show_time_left_book = "karenda_screensaver_show_time_left_book",
        show_days = "karenda_screensaver_show_days",
        show_pages_read = "karenda_screensaver_show_pages_read",
        show_average_speed = "karenda_screensaver_show_average_speed",
        vertical_position = "karenda_screensaver_vertical_position",
        horizontal_alignment = "karenda_screensaver_horizontal_alignment",
        stats_layout = "karenda_screensaver_stats_layout",
        cover_fit = "karenda_screensaver_cover_fit",
    },
    defaults = {
        show_title = true,
        show_author = true,
        show_chapter = true,
        show_progress = true,
        show_chapter_progress = false,
        show_page = true,
        show_pages_left_chapter = true,
        show_pages_left_book = true,
        show_time = true,
        show_time_left_chapter = true,
        show_time_left_book = true,
        show_days = true,
        show_pages_read = false,
        show_average_speed = false,
        vertical_position = "bottom",
        horizontal_alignment = "center",
        stats_layout = "grid",
        cover_fit = "fit",
    },
    allowed_values = {
        vertical_position = { top = true, center = true, bottom = true },
        horizontal_alignment = { left = true, center = true, right = true },
        stats_layout = { row = true, grid = true },
        cover_fit = { fit = true, fill = true },
    },
}

local function readSetting(name)
    if not G_reader_settings or type(G_reader_settings.readSetting) ~= "function" then
        return nil
    end
    return G_reader_settings:readSetting(name)
end

local function saveSetting(name, value)
    if not G_reader_settings or type(G_reader_settings.saveSetting) ~= "function" then
        return false
    end
    G_reader_settings:saveSetting(name, value)
    return true
end

function ScreensaverConfig.isEnabled()
    return ScreensaverConfig.getBoolean("enabled", false)
end

function ScreensaverConfig.setEnabled(enabled)
    return saveSetting(ScreensaverConfig.setting, enabled == true)
end

function ScreensaverConfig.getBoolean(option, fallback)
    local setting = option == "enabled"
        and ScreensaverConfig.setting
        or ScreensaverConfig.visual_settings[option]
    if not setting then
        return fallback == true
    end

    local stored = readSetting(setting)
    if stored ~= nil then
        return stored == true
    end

    if option == "enabled" then
        return fallback == true
    end
    return ScreensaverConfig.defaults[option] == true
end

function ScreensaverConfig.getValue(option)
    local setting = ScreensaverConfig.visual_settings[option]
    if not setting then
        return nil
    end

    local stored = readSetting(setting)
    local allowed = ScreensaverConfig.allowed_values[option]
    if stored ~= nil and (not allowed or allowed[stored]) then
        return stored
    end
    return ScreensaverConfig.defaults[option]
end

function ScreensaverConfig.setValue(option, value)
    local setting = ScreensaverConfig.visual_settings[option]
    if not setting then
        return false
    end

    local default = ScreensaverConfig.defaults[option]
    if type(default) == "boolean" and type(value) ~= "boolean" then
        return false
    end
    local allowed = ScreensaverConfig.allowed_values[option]
    if allowed and not allowed[value] then
        return false
    end

    return saveSetting(setting, value)
end

function ScreensaverConfig.resetVisualSettings()
    for option, value in pairs(ScreensaverConfig.defaults) do
        if not ScreensaverConfig.setValue(option, value) then
            return false
        end
    end
    return true
end

local function findWallpaperItems(menu_items)
    local screensaver = menu_items and menu_items.screensaver
    local root_items = screensaver and screensaver.sub_item_table
    if type(root_items) ~= "table" then
        return nil
    end

    for _, item in ipairs(root_items) do
        if item.sub_item_table and item.text == gettext("Wallpaper") then
            return item.sub_item_table
        end
    end

    return nil
end

local function checkboxItem(label, option)
    return {
        text = gettext(label),
        checked_func = function()
            return ScreensaverConfig.getBoolean(option)
        end,
        callback = function()
            ScreensaverConfig.setValue(option, not ScreensaverConfig.getBoolean(option))
        end,
    }
end

local function radioItem(label, option, value)
    return {
        text = gettext(label),
        checked_func = function()
            return ScreensaverConfig.getValue(option) == value
        end,
        callback = function()
            ScreensaverConfig.setValue(option, value)
        end,
        radio = true,
    }
end

function ScreensaverConfig.showPreview(ui)
    if not ui or not ui.document then
        local UIManager = require("ui/uimanager")
        local InfoMessage = require("ui/widget/infomessage")
        UIManager:show(InfoMessage:new{
            text = gettext("Abre un libro para ver la vista previa de la pantalla de bloqueo."),
            timeout = 4,
        })
        return false
    end

    return require("screensaver_preview").show(ui)
end

function ScreensaverConfig.addToMainMenu(menu_items, ui)
    local wallpaper_items = findWallpaperItems(menu_items)
    if not wallpaper_items then
        return false
    end

    for _, item in ipairs(wallpaper_items) do
        if item[ScreensaverConfig.menu_marker] then
            return true
        end
    end

    table.insert(wallpaper_items, 1, {
        text = gettext("Pantalla de bloqueo de Karenda"),
        help_text = gettext("En libros muestra la portada con estadísticas; en Calendario y Notas conserva la pantalla actual."),
        checked_func = function()
            return ScreensaverConfig.isEnabled()
        end,
        callback = function()
            ScreensaverConfig.setEnabled(not ScreensaverConfig.isEnabled())
        end,
        separator = true,
        [ScreensaverConfig.menu_marker] = true,
    })

    table.insert(wallpaper_items, 2, {
        text = gettext("Vista previa de Karenda"),
        help_text = gettext("Muestra el diseño actual. Toca la pantalla o pulsa una tecla para salir."),
        enabled_func = function()
            return ui and ui.document ~= nil
        end,
        callback = function()
            ScreensaverConfig.showPreview(ui)
        end,
    })

    table.insert(wallpaper_items, 3, {
        text = gettext("Personalizar pantalla de bloqueo"),
        help_text = gettext("Elige qué datos aparecen, su posición y la distribución de las tarjetas."),
        sub_item_table = {
            checkboxItem("Mostrar título", "show_title"),
            checkboxItem("Mostrar autor", "show_author"),
            checkboxItem("Mostrar capítulo", "show_chapter"),
            checkboxItem("Mostrar progreso", "show_progress"),
            checkboxItem("Mostrar progreso del capítulo", "show_chapter_progress"),
            checkboxItem("Mostrar página", "show_page"),
            checkboxItem("Mostrar páginas restantes del capítulo", "show_pages_left_chapter"),
            checkboxItem("Mostrar páginas restantes del libro", "show_pages_left_book"),
            checkboxItem("Mostrar tiempo de lectura", "show_time"),
            checkboxItem("Mostrar tiempo restante del capítulo", "show_time_left_chapter"),
            checkboxItem("Mostrar tiempo restante del libro", "show_time_left_book"),
            checkboxItem("Mostrar días de lectura", "show_days"),
            checkboxItem("Mostrar páginas leídas", "show_pages_read"),
            checkboxItem("Mostrar ritmo medio", "show_average_speed"),
            {
                text = gettext("Posición vertical"),
                sub_item_table = {
                    radioItem("Arriba", "vertical_position", "top"),
                    radioItem("Centro", "vertical_position", "center"),
                    radioItem("Abajo", "vertical_position", "bottom"),
                },
            },
            {
                text = gettext("Alineación horizontal"),
                sub_item_table = {
                    radioItem("Izquierda", "horizontal_alignment", "left"),
                    radioItem("Centro", "horizontal_alignment", "center"),
                    radioItem("Derecha", "horizontal_alignment", "right"),
                },
            },
            {
                text = gettext("Distribución de tarjetas"),
                sub_item_table = {
                    radioItem("Una fila", "stats_layout", "row"),
                    radioItem("Cuadrícula de 2 columnas", "stats_layout", "grid"),
                },
            },
            {
                text = gettext("Ajuste de portada"),
                sub_item_table = {
                    radioItem("Proporcional", "cover_fit", "fit"),
                    radioItem("Llenar pantalla", "cover_fit", "fill"),
                },
            },
            {
                text = gettext("Restablecer diseño"),
                separator = true,
                callback = function()
                    ScreensaverConfig.resetVisualSettings()
                end,
            },
        },
    })

    return true
end

return ScreensaverConfig
