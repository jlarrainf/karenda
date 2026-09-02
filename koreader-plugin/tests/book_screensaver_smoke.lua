local pluginPath = assert(arg[1], "Se requiere la ruta de karenda.koplugin.")
package.path = pluginPath .. "/?.lua;" .. package.path

require("setupkoenv")
G_defaults = require("luadefaults"):open()
local DataStorage = require("datastorage")
G_reader_settings = require("luasettings"):open(DataStorage:getDataDir() .. "/settings.reader.lua")

local Device = require("device")
require("document/canvascontext"):init(Device)
require("ui/bidi").setup(G_reader_settings:readSetting("language"))

local BookScreensaver = require("book_screensaver")
local RenderImage = require("ui/renderimage")
local cover = RenderImage:renderImageFile("resources/koreader.png", false, nil, nil)
local ui = {
    document = {
        getPageCount = function()
            return 240
        end,
        getTotalPagesLeft = function()
            return 144
        end,
    },
    bookinfo = {
        getCoverImage = function()
            return cover
        end,
    },
    doc_props = {
        display_title = "El libro de prueba",
        authors = "Autora de prueba",
    },
    doc_settings = {
        isTrue = function()
            return false
        end,
    },
    getCurrentPage = function()
        return 96
    end,
    statistics = {
        avg_time = 120,
        getStatsBookStatus = function()
            return { days = 4, time = 7320, pages = 81 }
        end,
    },
    toc = {
        getTocTitleByPage = function()
            return "Capítulo de prueba"
        end,
        getChapterPagesLeft = function()
            return 24
        end,
        getChapterPageCount = function()
            return 60
        end,
        getChapterPagesDone = function()
            return 36
        end,
    },
}

local data = assert(BookScreensaver.collectData(ui))
assert(data.pages_left_book == 144)
assert(data.pages_left_chapter == 24)
assert(data.time_left_book == "4 h 48 min")
assert(data.time_left_chapter == "48 min")
assert(data.average_speed == "2 min/pág")

local widget = assert(BookScreensaver.build(ui))
local size = widget:getSize()
assert(size.w == Device.screen:getWidth())
assert(size.h == Device.screen:getHeight())
assert(widget[2] ~= nil)
local content_size = widget[2]:getSize()
assert(content_size.w > 0)
assert(content_size.h > 0)
widget:paintTo(Device.screen.bb, 0, 0)
widget:free()

local saved_settings = G_reader_settings
local hidden_settings = {
    karenda_screensaver_show_title = false,
    karenda_screensaver_show_author = false,
    karenda_screensaver_show_chapter = false,
    karenda_screensaver_show_progress = false,
    karenda_screensaver_show_chapter_progress = false,
    karenda_screensaver_show_page = false,
    karenda_screensaver_show_pages_left_chapter = false,
    karenda_screensaver_show_pages_left_book = false,
    karenda_screensaver_show_time = false,
    karenda_screensaver_show_time_left_chapter = false,
    karenda_screensaver_show_time_left_book = false,
    karenda_screensaver_show_days = false,
    karenda_screensaver_show_pages_read = false,
    karenda_screensaver_show_average_speed = false,
    karenda_screensaver_vertical_position = "top",
    karenda_screensaver_horizontal_alignment = "left",
    karenda_screensaver_stats_layout = "grid",
    karenda_screensaver_cover_fit = "fit",
}
function hidden_settings:readSetting(name)
    return self[name]
end
G_reader_settings = hidden_settings

local no_content_ui = {
    document = ui.document,
    bookinfo = {
        getCoverImage = function()
            return nil
        end,
    },
    doc_props = ui.doc_props,
    doc_settings = ui.doc_settings,
    getCurrentPage = ui.getCurrentPage,
    statistics = ui.statistics,
    toc = ui.toc,
}
local no_content_widget = assert(BookScreensaver.build(no_content_ui))
assert(no_content_widget[2] == nil)
no_content_widget:paintTo(Device.screen.bb, 0, 0)
no_content_widget:free()
G_reader_settings = saved_settings

print("book_screensaver_smoke: OK")
