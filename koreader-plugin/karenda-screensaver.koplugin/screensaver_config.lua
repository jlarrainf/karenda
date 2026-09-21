local gettext = require("gettext")

local ScreensaverConfig = {
    setting = "karenda_screensaver_enabled",
    menu_marker = "karenda_screensaver_menu_item",
    visual_settings = {
        show_title = "karenda_screensaver_show_title",
        show_author = "karenda_screensaver_show_author",
        show_chapter = "karenda_screensaver_show_chapter",
        -- Kept for settings compatibility; book progress is structural.
        show_progress = "karenda_screensaver_show_progress",
        show_chapter_progress = "karenda_screensaver_show_chapter_progress",
        show_page = "karenda_screensaver_show_page",
        show_pages_left_chapter = "karenda_screensaver_show_pages_left_chapter",
        show_pages_left_book = "karenda_screensaver_show_pages_left_book",
        show_time = "karenda_screensaver_show_time",
        show_time_left_chapter = "karenda_screensaver_show_time_left_chapter",
        show_time_left_book = "karenda_screensaver_show_time_left_book",
        show_today = "karenda_screensaver_show_today",
        show_days = "karenda_screensaver_show_days",
        show_pages_read = "karenda_screensaver_show_pages_read",
        show_average_speed = "karenda_screensaver_show_average_speed",
        combine_remaining = "karenda_screensaver_combine_remaining",
        vertical_position = "karenda_screensaver_vertical_position",
        horizontal_alignment = "karenda_screensaver_horizontal_alignment",
        stats_layout = "karenda_screensaver_stats_layout",
        cover_fit = "karenda_screensaver_cover_fit",
        context_policy = "karenda_screensaver_context_policy",
        no_book_policy = "karenda_screensaver_no_book_policy",
        panel_style = "karenda_screensaver_panel_style",
        metric_order = "karenda_screensaver_metric_order",
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
        show_today = true,
        show_days = true,
        show_pages_read = false,
        show_average_speed = false,
        combine_remaining = true,
        vertical_position = "bottom",
        horizontal_alignment = "center",
        stats_layout = "grid",
        cover_fit = "fit",
        context_policy = "preserve",
        no_book_policy = "delegate",
        panel_style = "minimal",
        metric_order = "page,pages_left_chapter,time_left_chapter,pages_left_book,time_left_book,today,time,days,pages_read,average_speed,chapter_progress",
    },
    allowed_values = {
        vertical_position = { top = true, center = true, bottom = true },
        horizontal_alignment = { left = true, center = true, right = true },
        stats_layout = { row = true, grid = true },
        cover_fit = { fit = true, fill = true },
        context_policy = { preserve = true, book = true },
        no_book_policy = { delegate = true, as_is = true },
        panel_style = { minimal = true, cards = true },
    },
    metric_catalog = {
        { id = "page", option = "show_page", label = "Página", compact_label = "Página" },
        { id = "pages_left_chapter", option = "show_pages_left_chapter", label = "Páginas restantes del capítulo", compact_label = "Págs. del capítulo" },
        { id = "time_left_chapter", option = "show_time_left_chapter", label = "Tiempo restante del capítulo", compact_label = "Tiempo del capítulo" },
        { id = "pages_left_book", option = "show_pages_left_book", label = "Páginas restantes del libro", compact_label = "Págs. del libro" },
        { id = "time_left_book", option = "show_time_left_book", label = "Tiempo restante del libro", compact_label = "Tiempo del libro" },
        { id = "today", option = "show_today", label = "Leído hoy", compact_label = "Leído hoy" },
        { id = "time", option = "show_time", label = "Tiempo leído", compact_label = "Tiempo leído" },
        { id = "days", option = "show_days", label = "Días de lectura", compact_label = "Días de lectura" },
        { id = "pages_read", option = "show_pages_read", label = "Páginas leídas", compact_label = "Págs. leídas" },
        { id = "average_speed", option = "show_average_speed", label = "Ritmo medio", compact_label = "Ritmo medio" },
        { id = "chapter_progress", option = "show_chapter_progress", label = "Progreso del capítulo", compact_label = "Progreso del capítulo" },
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

local function trim(value)
    return tostring(value):match("^%s*(.-)%s*$")
end

local function findMetric(id)
    for _, metric in ipairs(ScreensaverConfig.metric_catalog) do
        if metric.id == id then
            return metric
        end
    end
    return nil
end

local function defaultMetricOrder()
    local order = {}
    for value in ScreensaverConfig.defaults.metric_order:gmatch("[^,]+") do
        table.insert(order, value)
    end
    return order
end

local function normalizeMetricOrder(value)
    local input = {}
    if type(value) == "string" then
        for item in value:gmatch("[^,]+") do
            table.insert(input, trim(item))
        end
    elseif type(value) == "table" then
        input = value
    end

    local order = {}
    local seen = {}
    for _, id in ipairs(input) do
        id = trim(id)
        if findMetric(id) and not seen[id] then
            table.insert(order, id)
            seen[id] = true
        end
    end

    for _, id in ipairs(defaultMetricOrder()) do
        if findMetric(id) and not seen[id] then
            table.insert(order, id)
            seen[id] = true
        end
    end

    return order
end

local function serializeMetricOrder(order)
    return table.concat(normalizeMetricOrder(order), ",")
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
    if option == "metric_order" then
        return serializeMetricOrder(stored or ScreensaverConfig.defaults.metric_order)
    end

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

    if option == "metric_order" then
        if type(value) ~= "table" and type(value) ~= "string" then
            return false
        end
        return saveSetting(setting, serializeMetricOrder(value))
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

function ScreensaverConfig.getMetricOrder()
    return normalizeMetricOrder(ScreensaverConfig.getValue("metric_order"))
end

function ScreensaverConfig.setMetricOrder(order)
    return ScreensaverConfig.setValue("metric_order", order)
end

function ScreensaverConfig.getMetric(id)
    return findMetric(id)
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

local function checkboxItem(label, option, help_text)
    local item = {
        text = gettext(label),
        checked_func = function()
            return ScreensaverConfig.getBoolean(option)
        end,
        callback = function()
            ScreensaverConfig.setValue(option, not ScreensaverConfig.getBoolean(option))
        end,
    }
    if help_text then
        item.help_text = gettext(help_text)
    end
    return item
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

local function moveMetric(id, offset)
    local order = ScreensaverConfig.getMetricOrder()
    local index
    for position, value in ipairs(order) do
        if value == id then
            index = position
            break
        end
    end
    if not index then
        return false
    end

    local target = math.max(1, math.min(#order, index + offset))
    if target == index then
        return true
    end

    order[index], order[target] = order[target], order[index]
    return ScreensaverConfig.setMetricOrder(order)
end

local function placeMetric(id, target)
    local order = ScreensaverConfig.getMetricOrder()
    local index
    for position, value in ipairs(order) do
        if value == id then
            index = position
            break
        end
    end
    if not index then
        return false
    end

    table.remove(order, index)
    table.insert(order, math.max(1, math.min(#order + 1, target)), id)
    return ScreensaverConfig.setMetricOrder(order)
end

local function metricOrderMenu()
    local items = {}
    for index, id in ipairs(ScreensaverConfig.getMetricOrder()) do
        local metric = findMetric(id)
        table.insert(items, {
            text = string.format("%d. %s", index, gettext(metric.label)),
            sub_item_table = {
                {
                    text = gettext("Subir"),
                    enabled_func = function()
                        local current = ScreensaverConfig.getMetricOrder()
                        for position, value in ipairs(current) do
                            if value == id then
                                return position > 1
                            end
                        end
                        return false
                    end,
                    callback = function()
                        moveMetric(id, -1)
                    end,
                },
                {
                    text = gettext("Bajar"),
                    enabled_func = function()
                        local current = ScreensaverConfig.getMetricOrder()
                        for position, value in ipairs(current) do
                            if value == id then
                                return position < #current
                            end
                        end
                        return false
                    end,
                    callback = function()
                        moveMetric(id, 1)
                    end,
                },
                {
                    text = gettext("Mover al principio"),
                    callback = function()
                        placeMetric(id, 1)
                    end,
                },
                {
                    text = gettext("Mover al final"),
                    callback = function()
                        placeMetric(id, #ScreensaverConfig.getMetricOrder() + 1)
                    end,
                },
            },
        })
    end
    return items
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
        text = gettext("Pantalla de bloqueo de lectura"),
        help_text = gettext("Muestra la portada y las estadísticas locales del libro."),
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
        text = gettext("Vista previa de pantalla de lectura"),
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
        help_text = gettext("Elige los datos, su orden, la posición y el estilo del panel."),
        sub_item_table = {
            checkboxItem("Mostrar título", "show_title"),
            checkboxItem("Mostrar autor", "show_author"),
            checkboxItem("Mostrar capítulo", "show_chapter"),
            checkboxItem("Mostrar progreso del capítulo", "show_chapter_progress"),
            checkboxItem("Mostrar página", "show_page"),
            checkboxItem("Mostrar páginas restantes del capítulo", "show_pages_left_chapter"),
            checkboxItem("Mostrar páginas restantes del libro", "show_pages_left_book"),
            checkboxItem("Mostrar tiempo leído", "show_time"),
            checkboxItem("Mostrar tiempo restante del capítulo", "show_time_left_chapter"),
            checkboxItem("Mostrar tiempo restante del libro", "show_time_left_book"),
            checkboxItem("Mostrar leído hoy", "show_today"),
            checkboxItem("Mostrar días de lectura", "show_days"),
            checkboxItem("Mostrar páginas leídas", "show_pages_read"),
            checkboxItem("Mostrar ritmo medio", "show_average_speed"),
            checkboxItem(
                "Agrupar páginas y tiempo restantes",
                "combine_remaining",
                "Muestra Capítulo y Libro completo como páginas / tiempo cuando ambos datos están disponibles."
            ),
            {
                text = gettext("Orden de estadísticas"),
                help_text = gettext("Cambia el orden de las filas de información."),
                sub_item_table = metricOrderMenu(),
            },
            {
                text = gettext("Estilo de información"),
                sub_item_table = {
                    radioItem("Minimalista", "panel_style", "minimal"),
                    radioItem("Tarjetas clásicas", "panel_style", "cards"),
                },
            },
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
                text = gettext("Distribución de tarjetas clásicas"),
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

    table.insert(wallpaper_items, 4, {
        text = gettext("Comportamiento en Calendario y Notas"),
        help_text = gettext("Elige qué hacer si hay una vista de Karenda visible."),
        sub_item_table = {
            radioItem("Conservar la pantalla actual", "context_policy", "preserve"),
            radioItem("Mostrar la portada del libro", "context_policy", "book"),
        },
    })

    table.insert(wallpaper_items, 5, {
        text = gettext("Comportamiento fuera de un libro"),
        help_text = gettext("Elige qué hacer cuando no hay un libro activo."),
        sub_item_table = {
            radioItem("Usar el salvapantallas de KOReader", "no_book_policy", "delegate"),
            radioItem("Dejar la pantalla intacta", "no_book_policy", "as_is"),
        },
    })

    return true
end

return ScreensaverConfig
