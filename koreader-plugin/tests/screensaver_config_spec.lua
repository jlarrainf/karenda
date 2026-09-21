local pluginPath = assert(arg[1], "Se requiere la ruta de karenda-screensaver.koplugin.")
package.path = pluginPath .. "/?.lua;" .. package.path

local saved_settings = G_reader_settings
local settings = {
    karenda_screensaver_enabled = false,
}
function settings:isTrue(name)
    return self[name] == true
end
function settings:readSetting(name)
    return self[name]
end
function settings:saveSetting(name, value)
    self[name] = value
end
G_reader_settings = settings

package.loaded["gettext"] = function(value)
    return value
end

local ScreensaverConfig = require("screensaver_config")
local wallpaper_items = {
    { text = "Show book cover on sleep screen" },
}
local menu_items = {
    screensaver = {
        sub_item_table = {
            {
                text = "Wallpaper",
                sub_item_table = wallpaper_items,
            },
        },
    },
}

local menu_ui = { document = {} }
assert(ScreensaverConfig.addToMainMenu(menu_items, menu_ui))
assert(#wallpaper_items == 6)
local wallpaper_item = wallpaper_items[1]
assert(wallpaper_item.karenda_screensaver_menu_item)
assert(wallpaper_item.text == "Pantalla de bloqueo de lectura")
assert(wallpaper_item.checked_func() == false)
wallpaper_item.callback()
assert(wallpaper_item.checked_func() == true)

local preview_item = wallpaper_items[2]
assert(preview_item.text == "Vista previa de pantalla de lectura")
assert(preview_item.enabled_func())

local customization_item = wallpaper_items[3]
assert(customization_item.text == "Personalizar pantalla de bloqueo")
assert(#customization_item.sub_item_table == 22)
assert(ScreensaverConfig.getBoolean("show_title") == true)
assert(ScreensaverConfig.getValue("vertical_position") == "bottom")
assert(ScreensaverConfig.getValue("stats_layout") == "grid")
assert(ScreensaverConfig.getValue("cover_fit") == "fit")
assert(ScreensaverConfig.getValue("panel_style") == "minimal")
assert(ScreensaverConfig.getValue("context_policy") == "preserve")
assert(ScreensaverConfig.getValue("no_book_policy") == "delegate")
assert(ScreensaverConfig.getBoolean("show_time_left_chapter") == true)
assert(ScreensaverConfig.getBoolean("show_time_left_book") == true)
assert(ScreensaverConfig.getBoolean("show_today") == true)
assert(ScreensaverConfig.getBoolean("show_average_speed") == false)
assert(ScreensaverConfig.getBoolean("combine_remaining") == true)

customization_item.sub_item_table[11].callback()
assert(ScreensaverConfig.getBoolean("show_today") == false)
customization_item.sub_item_table[11].callback()
assert(ScreensaverConfig.getBoolean("show_today") == true)

local metric_order = ScreensaverConfig.getMetricOrder()
assert(metric_order[1] == "page")
assert(ScreensaverConfig.setMetricOrder({ "time", "invalid", "page" }))
metric_order = ScreensaverConfig.getMetricOrder()
assert(metric_order[1] == "time")
assert(metric_order[2] == "page")
assert(#metric_order == 11)

assert(ScreensaverConfig.setValue("context_policy", "book"))
assert(ScreensaverConfig.setValue("no_book_policy", "as_is"))
assert(ScreensaverConfig.setValue("panel_style", "cards"))
assert(ScreensaverConfig.getValue("context_policy") == "book")
assert(ScreensaverConfig.getValue("no_book_policy") == "as_is")
assert(ScreensaverConfig.getValue("panel_style") == "cards")
assert(ScreensaverConfig.setValue("stats_layout", "invalid") == false)
settings.karenda_screensaver_vertical_position = "invalid"
assert(ScreensaverConfig.getValue("vertical_position") == "bottom")
settings.karenda_screensaver_vertical_position = nil

customization_item.sub_item_table[1].callback()
assert(ScreensaverConfig.getBoolean("show_title") == false)
customization_item.sub_item_table[15].callback()
assert(ScreensaverConfig.getBoolean("combine_remaining") == false)
customization_item.sub_item_table[18].sub_item_table[1].callback()
assert(ScreensaverConfig.getValue("vertical_position") == "top")
customization_item.sub_item_table[20].sub_item_table[2].callback()
assert(ScreensaverConfig.getValue("stats_layout") == "grid")
customization_item.sub_item_table[21].sub_item_table[2].callback()
assert(ScreensaverConfig.getValue("cover_fit") == "fill")
customization_item.sub_item_table[22].callback()
assert(ScreensaverConfig.getBoolean("show_title") == true)
assert(ScreensaverConfig.getValue("vertical_position") == "bottom")
assert(ScreensaverConfig.getValue("stats_layout") == "grid")
assert(ScreensaverConfig.getValue("cover_fit") == "fit")
assert(ScreensaverConfig.getValue("panel_style") == "minimal")
assert(ScreensaverConfig.getValue("context_policy") == "preserve")
assert(ScreensaverConfig.getValue("no_book_policy") == "delegate")
assert(ScreensaverConfig.getBoolean("combine_remaining") == true)
assert(ScreensaverConfig.getMetricOrder()[1] == "page")

assert(ScreensaverConfig.addToMainMenu(menu_items))
assert(#wallpaper_items == 6)
G_reader_settings = saved_settings
print("screensaver_config_spec: OK")
