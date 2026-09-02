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
local Screensaver = require("ui/screensaver")
local ScreensaverPreview = require("screensaver_preview")
local cover = RenderImage:renderImageFile("resources/koreader.png", false, nil, nil)
local ui = {
    document = {
        getPageCount = function()
            return 180
        end,
    },
    bookinfo = {
        getCoverImage = function()
            return cover
        end,
    },
    doc_props = {
        display_title = "Libro de vista previa",
        authors = "Autora de prueba",
    },
    doc_settings = {
        isTrue = function()
            return false
        end,
    },
    getCurrentPage = function()
        return 72
    end,
    statistics = {
        getStatsBookStatus = function()
            return { days = 3, time = 3660 }
        end,
    },
    toc = {
        getTocTitleByPage = function()
            return "Capítulo de prueba"
        end,
    },
}

local cleanup_calls = 0
local original_cleanup = Screensaver.cleanup
Screensaver.cleanup = function(self)
    cleanup_calls = cleanup_calls + 1
    return original_cleanup(self)
end

local preview = assert(ScreensaverPreview.show(ui))
assert(Device.screen_saver_mode ~= true)
assert(Screensaver.screensaver_widget == nil)
assert(Screensaver.screensaver_lock_widget == nil)
preview:paintTo(Device.screen.bb, 0, 0)
assert(preview._closing ~= true)

assert(preview:onAnyKeyPressed() == true)
assert(preview._closing == true)
assert(cleanup_calls == 0)
assert(Device.screen_saver_mode ~= true)
assert(Screensaver.screensaver_widget == nil)
assert(Screensaver.screensaver_lock_widget == nil)

local touch_preview = assert(ScreensaverPreview.show(ui))
assert(touch_preview:onClosePreview() == true)
assert(touch_preview._closing == true)
assert(cleanup_calls == 0)

Screensaver.cleanup = original_cleanup
print("screensaver_preview_smoke: OK")
