local pluginPath = arg[1] or "../karenda.koplugin"
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
assert(#wallpaper_items == 4)
local karenda_item = wallpaper_items[1]
assert(karenda_item.karenda_screensaver_menu_item)
assert(karenda_item.checked_func() == false)
karenda_item.callback()
assert(karenda_item.checked_func() == true)

local preview_item = wallpaper_items[2]
assert(preview_item.text == "Vista previa de Karenda")
assert(preview_item.enabled_func())

local customization_item = wallpaper_items[3]
assert(customization_item.text == "Personalizar pantalla de bloqueo")
assert(#customization_item.sub_item_table == 19)
assert(ScreensaverConfig.getBoolean("show_title") == true)
assert(ScreensaverConfig.getValue("vertical_position") == "bottom")
assert(ScreensaverConfig.getValue("stats_layout") == "grid")
assert(ScreensaverConfig.getValue("cover_fit") == "fit")
assert(ScreensaverConfig.getBoolean("show_time_left_chapter") == true)
assert(ScreensaverConfig.getBoolean("show_time_left_book") == true)
assert(ScreensaverConfig.getBoolean("show_average_speed") == false)
settings.karenda_screensaver_vertical_position = "invalid"
assert(ScreensaverConfig.getValue("vertical_position") == "bottom")
assert(ScreensaverConfig.setValue("stats_layout", "invalid") == false)
settings.karenda_screensaver_vertical_position = nil

customization_item.sub_item_table[1].callback()
assert(ScreensaverConfig.getBoolean("show_title") == false)
customization_item.sub_item_table[15].sub_item_table[1].callback()
assert(ScreensaverConfig.getValue("vertical_position") == "top")
customization_item.sub_item_table[17].sub_item_table[2].callback()
assert(ScreensaverConfig.getValue("stats_layout") == "grid")
customization_item.sub_item_table[18].sub_item_table[2].callback()
assert(ScreensaverConfig.getValue("cover_fit") == "fill")
customization_item.sub_item_table[19].callback()
assert(ScreensaverConfig.getBoolean("show_title") == true)
assert(ScreensaverConfig.getValue("vertical_position") == "bottom")
assert(ScreensaverConfig.getValue("stats_layout") == "grid")
assert(ScreensaverConfig.getValue("cover_fit") == "fit")

assert(ScreensaverConfig.addToMainMenu(menu_items))
assert(#wallpaper_items == 4)

G_reader_settings = saved_settings
print("screensaver_config_spec: OK")
