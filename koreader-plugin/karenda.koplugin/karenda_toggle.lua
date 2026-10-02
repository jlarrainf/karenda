local Blitbuffer = require("ffi/blitbuffer")
local ButtonTable = require("ui/widget/buttontable")
local Size = require("ui/size")

local KarendaToggle = {}

function KarendaToggle.new(width, selected, show_parent, onSelect)
    local function makeButton(kind, label)
        local is_selected = selected == kind
        return {
            id = "karenda-surface-" .. kind,
            text = label,
            font_size = 14,
            font_bold = is_selected,
            height = Size.item.height_big,
            avoid_text_truncation = false,
            background = is_selected and Blitbuffer.COLOR_LIGHT_GRAY or nil,
            callback = function()
                if not is_selected then
                    onSelect(kind)
                end
            end,
        }
    end

    return ButtonTable:new{
        width = width,
        show_parent = show_parent,
        zero_sep = true,
        buttons = {
            {
                makeButton("calendar", "Calendario"),
                makeButton("notes", "Notas"),
            },
        },
    }
end

return KarendaToggle
