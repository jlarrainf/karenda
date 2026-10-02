local WidgetContainer = require("ui/widget/container/widgetcontainer")

local ScreensaverConfig = require("screensaver_config")
local ScreensaverIntegration = require("screensaver_integration")

local Wallpaper = WidgetContainer:extend{
    name = "karenda-screensaver",
    is_doc_only = false,
}

function Wallpaper:init()
    ScreensaverIntegration.ensureInstalled()
    self.ui.menu:registerToMainMenu(self)
end

function Wallpaper:addToMainMenu(menu_items)
    ScreensaverConfig.addToMainMenu(menu_items, self.ui)
end

function Wallpaper:onResume()
    ScreensaverIntegration.ensureInstalled()
end

return Wallpaper
