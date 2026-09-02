local pluginPath = assert(arg[1], "Se requiere la ruta de karenda.koplugin.")
package.path = pluginPath .. "/?.lua;" .. package.path

require("setupkoenv")
G_defaults = require("luadefaults"):open()
local DataStorage = require("datastorage")
G_reader_settings = require("luasettings"):open(DataStorage:getDataDir() .. "/settings.reader.lua")

local Device = require("device")
require("document/canvascontext"):init(Device)
require("ui/bidi").setup(G_reader_settings:readSetting("language"))

local RenderImage = require("ui/renderimage")
local Runtime = require("runtime")
local Screensaver = require("ui/screensaver")
local Integration = require("screensaver_integration")
local cover = RenderImage:renderImageFile("resources/koreader.png", false, nil, nil)
local ui = {
    document = {
        getPageCount = function()
            return 240
        end,
    },
    bookinfo = {
        getCoverImage = function()
            return cover
        end,
    },
    doc_props = {
        display_title = "Libro de integración",
        authors = "Autora de integración",
    },
    doc_settings = {
        isTrue = function()
            return false
        end,
    },
    getCurrentPage = function()
        return 48
    end,
    statistics = {
        getStatsBookStatus = function()
            return { days = 2, time = 3600, pages = 40 }
        end,
    },
}

local previous_enabled = G_reader_settings:readSetting("karenda_screensaver_enabled")
local previous_delay = G_reader_settings:readSetting("screensaver_delay")
G_reader_settings:saveSetting("karenda_screensaver_enabled", true)
G_reader_settings:saveSetting("screensaver_delay", "disable")
Runtime.clearContext()
Screensaver.ui = ui
Screensaver.screensaver_type = "cover"
Screensaver.show_message = false
Screensaver.overlay_message = nil
Integration.ensureInstalled()
Screensaver:show()

assert(Screensaver.screensaver_widget ~= nil)
assert(Device.screen_saver_mode == true)
Screensaver.screensaver_widget:onClose()
Screensaver:cleanup()
assert(Device.screen_saver_mode == false)

G_reader_settings:saveSetting("karenda_screensaver_enabled", previous_enabled)
G_reader_settings:saveSetting("screensaver_delay", previous_delay)
print("screensaver_runtime_smoke: OK")
