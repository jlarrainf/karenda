local Blitbuffer = require("ffi/blitbuffer")
local ButtonTable = require("ui/widget/buttontable")
local CenterContainer = require("ui/widget/container/centercontainer")
local Device = require("device")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local InputContainer = require("ui/widget/container/inputcontainer")
local LeftContainer = require("ui/widget/container/leftcontainer")
local LineWidget = require("ui/widget/linewidget")
local ScrollableContainer = require("ui/widget/container/scrollablecontainer")
local Size = require("ui/size")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextViewer = require("ui/widget/textviewer")
local TextWidget = require("ui/widget/textwidget")
local TitleBar = require("ui/widget/titlebar")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")

local CalendarData = require("calendar_data")
local DateUtils = require("date_utils")
local SurfaceNavigation = require("surface_navigation")

local Screen = Device.screen
local CalendarView = {}

local PREVIEW_LIMIT = 4
local MODE_ORDER = { "agenda", "month", "week", "day" }

local function datePart(value)
    if type(value) ~= "string" then
        return nil
    end
    return value:match("^(%d%d%d%d%-%d%d%-%d%d)")
end

local function dateLabel(value)
    return CalendarData.dateLabel(datePart(value) or value)
end

local function momentLabel(value)
    if type(value) ~= "string" then
        return ""
    end

    local date, hour, minute = value:match("^(%d%d%d%d%-%d%d%-%d%d)T(%d%d):(%d%d)")
    if not date then
        return dateLabel(value)
    end
    return string.format("%s %s:%s", dateLabel(date), hour, minute)
end

local function timeLabel(value)
    if type(value) ~= "string" then
        return ""
    end
    local hour, minute = value:match("^%d%d%d%d%-%d%d%-%d%dT(%d%d):(%d%d)")
    return hour and string.format("%s:%s", hour, minute) or ""
end

local function indexById(rows)
    local result = {}
    for _, row in ipairs(rows or {}) do
        result[row.id] = row
    end
    return result
end

local function statusLabel(status)
    return status == "completed" and "Completado" or "Pendiente"
end

local function kindLabel(kind)
    return kind == "academic" and "Académico" or "Personal"
end

local function relationName(event, subjects, personalGroups)
    if event.kind == "academic" then
        local subject = subjects[event.subjectId]
        return subject and subject.name or "Sin asignatura"
    end

    local group = personalGroups[event.personalGroupId]
    return group and group.name or "Sin grupo"
end

local function relationLabel(event, subjects, personalGroups)
    if event.kind == "academic" then
        return "Asignatura: " .. relationName(event, subjects, personalGroups)
    end
    return "Grupo: " .. relationName(event, subjects, personalGroups)
end

local function countLabel(count)
    return count == 1 and "1 evento" or tostring(count) .. " eventos"
end

local function capitalize(value)
    return (value or ""):gsub("^%l", string.upper)
end

local function agendaGroupLabel(value, today)
    local label = CalendarData.fullDayLabel(value)
    if value == today then
        return "HOY · " .. label
    end
    if value == DateUtils.addDays(today, 1) then
        return "MAÑANA · " .. label
    end
    return label
end

local function eventMetadata(event, subjects, personalGroups)
    local labels = {
        kindLabel(event.kind),
        relationName(event, subjects, personalGroups),
        statusLabel(event.status),
    }
    if event.kind == "academic" and event.status == "pending" then
        labels[#labels + 1] = "Estudiar"
    end
    return table.concat(labels, " · ")
end

local function eventCountdownLabel(event, today)
    if type(event) ~= "table" or event.status == "completed" then
        return ""
    end

    local days = CalendarData.daysRemaining(event, today)
    if not days then
        return ""
    end
    if days < 0 then
        local elapsed = math.abs(days)
        return elapsed == 1
            and "Vencido hace 1 día"
            or "Vencido hace " .. tostring(elapsed) .. " días"
    end
    if days == 0 then
        return "Hoy"
    end
    if days == 1 then
        return "Mañana"
    end
    return "Faltan " .. tostring(days) .. " días"
end

local function eventSchedule(event)
    local start_date = datePart(event.startAt)
    local end_date = datePart(event.endAt)
    if event.allDay then
        if end_date and end_date ~= start_date then
            return "Todo el día - " .. CalendarData.shortDateLabel(end_date)
        end
        return "Todo el día"
    end

    local start_time = timeLabel(event.startAt)
    local end_time = timeLabel(event.endAt)
    if end_time ~= "" and end_date == start_date then
        return start_time .. "-" .. end_time
    end
    if end_time ~= "" and end_date then
        return start_time .. " - " .. CalendarData.shortDateLabel(end_date) .. " " .. end_time
    end
    return start_time
end

local function eventMarker(event, showDate)
    local schedule = eventSchedule(event)
    if not showDate then
        return schedule
    end
    return CalendarData.compactDayLabel(datePart(event.startAt)) .. "\n" .. schedule
end

local function eventDetails(event, subjects, personalGroups, today)
    local lines = {
        event.title,
        "",
        "Tipo: " .. kindLabel(event.kind),
        "Estado: " .. statusLabel(event.status),
        relationLabel(event, subjects, personalGroups),
    }
    local countdown = eventCountdownLabel(event, today or DateUtils.todayKey())
    if countdown ~= "" then
        lines[#lines + 1] = "Tiempo restante: " .. countdown
    end

    if event.allDay then
        lines[#lines + 1] = "Fecha: " .. dateLabel(event.startAt)
        if event.endAt and event.endAt ~= event.startAt then
            lines[#lines] = lines[#lines] .. " - " .. dateLabel(event.endAt)
        end
    else
        lines[#lines + 1] = "Horario: " .. momentLabel(event.startAt)
        if event.endAt then
            lines[#lines] = lines[#lines] .. " - " .. momentLabel(event.endAt)
        end
    end

    if event.location and event.location ~= "" then
        lines[#lines + 1] = "Lugar: " .. event.location
    end
    if event.description and event.description ~= "" then
        lines[#lines + 1] = ""
        lines[#lines + 1] = event.description
    end

    return table.concat(lines, "\n")
end

local function fixedText(text, width, height, options)
    options = options or {}
    local widget = TextWidget:new{
        text = text,
        face = Font:getFace(options.face or "smallinfofont", options.fontSize or 16),
        bold = options.bold or false,
        max_width = width,
        padding = 0,
    }
    local container = options.align == "center" and CenterContainer or LeftContainer
    return container:new{
        dimen = Geom:new{ w = width, h = height },
        widget,
    }
end

local function messageBlock(text, width, bold)
    local padding = Size.padding.large
    return FrameContainer:new{
        bordersize = 0,
        padding = padding,
        TextBoxWidget:new{
            text = text,
            width = width - 2 * padding,
            face = Font:getFace("smallinfofont", 16),
            bold = bold or false,
            line_height = 0.2,
        },
    }
end

local function sectionHeader(text, width)
    local height = Size.item.height_default
    return VerticalGroup:new{
        fixedText(text, width, height, {
            face = "smallinfofont",
            fontSize = 15,
            bold = true,
        }),
        LineWidget:new{
            background = Blitbuffer.COLOR_BLACK,
            dimen = Geom:new{ w = width, h = Size.line.medium },
        },
    }
end

local function weekdayHeader(width)
    local labels = { "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom" }
    local separator_width = Size.line.medium
    local available = width - separator_width * 6
    local default_width = math.floor(available / 7)
    local remaining = available - default_width * 7
    local height = Size.item.height_default
    local row = HorizontalGroup:new{}

    for index, label in ipairs(labels) do
        local cell_width = default_width + (index == 7 and remaining or 0)
        table.insert(row, fixedText(label, cell_width, height, {
            align = "center",
            face = "smallinfofont",
            fontSize = 14,
            bold = true,
        }))
        if index < 7 then
            table.insert(row, LineWidget:new{
                background = Blitbuffer.COLOR_DARK_GRAY,
                dimen = Geom:new{ w = separator_width, h = height },
            })
        end
    end
    return row
end

local EventRow = InputContainer:extend{
    width = nil,
    marker = nil,
    title = nil,
    metadata = nil,
    countdown = nil,
    emphasis = false,
    callback = nil,
}

function EventRow:init()
    local base_row_height = Size.item.height_large + 2 * Size.padding.default
    local horizontal_padding = Size.padding.large
    local marker_width = math.floor(self.width * 0.27)
    local separator_width = Size.line.medium
    local gap = Size.padding.large
    local content_width = self.width - 2 * horizontal_padding - marker_width - separator_width - gap

    local content = VerticalGroup:new{
        TextWidget:new{
            text = self.title,
            face = Font:getFace("cfont", 18),
            bold = true,
            max_width = content_width,
            padding = 0,
        },
        VerticalSpan:new{ width = Size.span.vertical_default },
        TextWidget:new{
            text = self.metadata,
            face = Font:getFace("smallinfofont", 14),
            max_width = content_width,
            padding = 0,
            bold = self.emphasis,
        },
    }
    if self.countdown and self.countdown ~= "" then
        table.insert(content, VerticalSpan:new{ width = Size.span.vertical_default })
        table.insert(content, TextWidget:new{
            text = self.countdown,
            face = Font:getFace("smallinfofont", 14),
            bold = true,
            max_width = content_width,
            padding = 0,
        })
    end

    local row_height = math.max(
        base_row_height,
        content:getSize().h + 2 * Size.padding.default
    )
    local marker = TextBoxWidget:new{
        text = self.marker,
        width = marker_width,
        height = row_height - 2 * Size.padding.default,
        height_adjust = true,
        height_overflow_show_ellipsis = true,
        face = Font:getFace("smallinfofont", 15),
        bold = true,
        line_height = 0.1,
    }

    local row = HorizontalGroup:new{
        HorizontalSpan:new{ width = horizontal_padding },
        LeftContainer:new{
            dimen = Geom:new{ w = marker_width, h = row_height },
            marker,
        },
        LineWidget:new{
            background = Blitbuffer.COLOR_DARK_GRAY,
            dimen = Geom:new{
                w = separator_width,
                h = row_height - 2 * Size.padding.default,
            },
        },
        HorizontalSpan:new{ width = gap },
        LeftContainer:new{
            dimen = Geom:new{ w = content_width, h = row_height },
            content,
        },
        HorizontalSpan:new{ width = horizontal_padding },
    }

    self.focusFrame = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        padding = 0,
        row,
    }
    self[1] = VerticalGroup:new{
        self.focusFrame,
        LineWidget:new{
            background = Blitbuffer.COLOR_DARK_GRAY,
            dimen = Geom:new{ w = self.width, h = Size.line.medium },
        },
    }
    self.dimen = Geom:new{
        w = self.width,
        h = self[1]:getSize().h,
    }
    self.ges_events = {
        TapSelectRow = {
            GestureRange:new{
                ges = "tap",
                range = self.dimen,
            },
        },
    }
end

function EventRow:onTapSelectRow()
    if self.callback then
        self.callback()
    end
    return true
end

function EventRow:onFocus()
    self.focusFrame.invert = true
    return true
end

function EventRow:onUnfocus()
    self.focusFrame.invert = false
    return true
end

local CalendarScreen = InputContainer:extend{
    plugin = nil,
    snapshot = nil,
    mode = "agenda",
    cursor = nil,
    today = nil,
    cursorFollowsToday = nil,
    subjects = nil,
    personalGroups = nil,
    detailViewer = nil,
    detailEvent = nil,
    titleBar = nil,
    refreshButton = nil,
    modeControl = nil,
    navbarHeight = 0,
    cropping_widget = nil,
    dayChangeAction = nil,
    covers_fullscreen = false,
    stop_events_propagation = true,
}

function CalendarScreen:init()
    self.dimen = Screen:getSize():copy()
    self.subjects = indexById(self.snapshot.subjects)
    self.personalGroups = indexById(self.snapshot.personalGroups)
    self.today = self.today or DateUtils.todayKey()
    self.cursor = self.cursor or self.today
    if self.cursorFollowsToday == nil then
        self.cursorFollowsToday = self.cursor == self.today
    end
    if Device:hasKeys() then
        self.key_events.Close = { { Device.input.group.Back } }
    end
    self:_build()
end

function CalendarScreen:_showEvent(event)
    self.plugin:setVisibleContext("calendar")
    self.detailEvent = event
    local viewer
    viewer = TextViewer:new{
        title = event.title,
        text = eventDetails(event, self.subjects, self.personalGroups, self.today),
        force_txt = true,
        show_menu = false,
        buttons_table = {
            {
                {
                    text = "Cerrar",
                    callback = function()
                        viewer:onClose()
                    end,
                },
            },
        },
        close_callback = function()
            if self.detailViewer == viewer then
                self.detailViewer = nil
                self.detailEvent = nil
            end
            if self.plugin.activeKarendaView == self then
                self.plugin:setVisibleContext("calendar")
            end
        end,
    }
    self.detailViewer = viewer
    UIManager:show(viewer)
end

function CalendarScreen:_eventRow(event, showDate, width)
    return EventRow:new{
        width = width,
        marker = eventMarker(event, showDate),
        title = event.title,
        metadata = eventMetadata(event, self.subjects, self.personalGroups),
        countdown = eventCountdownLabel(event, self.today),
        emphasis = event.kind == "academic" and event.status == "pending",
        callback = function()
            self:_showEvent(event)
        end,
    }
end

function CalendarScreen:_grid(data, today, width)
    local rows
    if self.mode == "month" then
        rows = CalendarData.monthGrid(data.period, data.events, data.visiblePeriod)
    else
        rows = CalendarData.weekGrid(data.period, data.events, data.visiblePeriod)
    end

    local buttons = {}
    for _, row in ipairs(rows) do
        local buttonRow = {}
        for _, cell in ipairs(row) do
            local selectable = cell.inPeriod and cell.available
            local isToday = cell.inPeriod and cell.date == today
            local text = ""
            if cell.inPeriod then
                local day = tostring(tonumber(cell.date:sub(9, 10)))
                if isToday then
                    day = "[" .. day .. "]"
                end
                text = cell.count > 0 and day .. " · " .. tostring(cell.count) or day
            end
            buttonRow[#buttonRow + 1] = {
                text = text,
                enabled = selectable,
                font_size = 15,
                font_bold = isToday or cell.count > 0,
                height = Size.item.height_default,
                avoid_text_truncation = false,
                background = isToday and Blitbuffer.COLOR_LIGHT_GRAY or nil,
                callback = function()
                    if selectable then
                        self.mode = "day"
                        self.cursor = cell.date
                        self.cursorFollowsToday = false
                        self:_refresh()
                    end
                end,
            }
        end
        buttons[#buttons + 1] = buttonRow
    end
    return ButtonTable:new{
        buttons = buttons,
        width = width,
        show_parent = self,
    }
end

function CalendarScreen:_appendPreview(body, data, today, width)
    local anchor = data.visiblePeriod.from
    if today >= data.visiblePeriod.from and today < data.visiblePeriod.to then
        anchor = today
    end
    local preview, total = CalendarData.previewEvents(
        data.events,
        data.visiblePeriod,
        anchor,
        PREVIEW_LIMIT
    )

    body[#body + 1] = VerticalSpan:new{ width = Size.span.vertical_large }
    body[#body + 1] = sectionHeader("PRÓXIMOS · " .. countLabel(total), width)
    if total == 0 then
        local message = #data.events == 0
            and "No hay eventos en este periodo."
            or "No quedan eventos en este periodo."
        body[#body + 1] = messageBlock(message, width)
        return
    end

    for _, event in ipairs(preview) do
        body[#body + 1] = self:_eventRow(event, true, width)
    end
    local remaining = total - #preview
    if remaining > 0 then
        body[#body + 1] = messageBlock(
            countLabel(remaining) .. " más. Consulta la vista Agenda para verlos.",
            width
        )
    end
end

function CalendarScreen:_appendDetailedEvents(body, data, width, today)
    if self.mode == "agenda" then
        body[#body + 1] = sectionHeader("PRÓXIMOS EVENTOS · " .. countLabel(#data.events), width)
    else
        body[#body + 1] = sectionHeader("EVENTOS DEL DÍA · " .. countLabel(#data.events), width)
    end

    if #data.events == 0 then
        local message = self.mode == "agenda"
            and "No hay eventos próximos en el snapshot."
            or "No hay eventos en este periodo."
        body[#body + 1] = messageBlock(message, width)
        return
    end

    if self.mode == "agenda" then
        local groups = CalendarData.groupEvents(data.events, data.visiblePeriod, false)
        for _, group in ipairs(groups) do
            body[#body + 1] = fixedText(agendaGroupLabel(group.date, today), width, Size.item.height_default, {
                face = "smallinfofont",
                fontSize = 15,
                bold = true,
            })
            for _, event in ipairs(group.events) do
                body[#body + 1] = self:_eventRow(event, false, width)
            end
        end
        return
    end

    for _, event in ipairs(data.events) do
        body[#body + 1] = self:_eventRow(event, false, width)
    end
end

function CalendarScreen:_body(data, today, width)
    local body = VerticalGroup:new{ align = "left" }
    if not data.period or not data.visiblePeriod then
        body[#body + 1] = messageBlock(
            "El periodo está fuera de la ventana sincronizada.",
            width,
            true
        )
        return body
    end

    if not CalendarData.isPeriodCovered(data.period, self.snapshot.window) then
        body[#body + 1] = messageBlock(
            "Mostrando solo la parte sincronizada del periodo.",
            width,
            true
        )
    end

    if self.mode == "month" or self.mode == "week" then
        body[#body + 1] = fixedText("DÍA · EVENTOS", width, Size.item.height_default, {
            face = "smallinfofont",
            fontSize = 13,
            bold = true,
        })
        body[#body + 1] = weekdayHeader(width)
        body[#body + 1] = self:_grid(data, today, width)
        self:_appendPreview(body, data, today, width)
    else
        self:_appendDetailedEvents(body, data, width, today)
    end
    body[#body + 1] = VerticalSpan:new{ width = Size.padding.large }
    return body
end

function CalendarScreen:_selectMode(mode)
    if mode ~= "month" and mode ~= "week" and mode ~= "agenda" and mode ~= "day" then
        return false
    end
    if self.mode == mode then
        return true
    end

    self.mode = mode
    if self.cursorFollowsToday then
        self.cursor = self.today
    else
        self.cursor = CalendarData.normalizeCursor(mode, self.cursor) or self.today
    end
    self:_refresh()
    return true
end

function CalendarScreen:_moveCursor(direction)
    local cursor = CalendarData.shift(self.mode, self.cursor, direction)
    if not cursor then
        return false
    end
    self.cursor = cursor
    self.cursorFollowsToday = false
    self:_refresh()
    return true
end

function CalendarScreen:_goToToday()
    self.today = DateUtils.todayKey()
    self.cursor = self.today
    self.cursorFollowsToday = true
    self:_scheduleTodayCheck()
    self:_refresh()
end

function CalendarScreen:_modeControl(width)
    local buttons = {}
    for _, mode in ipairs(MODE_ORDER) do
        local selected_mode = mode
        buttons[#buttons + 1] = {
            id = "mode-" .. mode,
            text = CalendarData.modeLabel(mode),
            font_size = 14,
            font_bold = self.mode == mode,
            height = Size.item.height_big,
            avoid_text_truncation = false,
            background = self.mode == mode and Blitbuffer.COLOR_LIGHT_GRAY or nil,
            callback = function()
                self:_selectMode(selected_mode)
            end,
        }
    end

    return ButtonTable:new{
        width = width,
        show_parent = self,
        zero_sep = true,
        buttons = { buttons },
    }
end

function CalendarScreen:_footer(width)
    return ButtonTable:new{
        width = width,
        show_parent = self,
        zero_sep = true,
        buttons = {
            {
                {
                    text = "Anterior",
                    font_size = 14,
                    height = Size.item.height_big,
                    callback = function()
                        self:_moveCursor(-1)
                    end,
                },
                {
                    text = "Hoy",
                    font_size = 14,
                    height = Size.item.height_big,
                    callback = function()
                        self:_goToToday()
                    end,
                },
                {
                    text = "Siguiente",
                    font_size = 14,
                    height = Size.item.height_big,
                    callback = function()
                        self:_moveCursor(1)
                    end,
                },
            },
        },
    }
end

function CalendarScreen:_scheduleTodayCheck()
    if self.dayChangeAction then
        UIManager:unschedule(self.dayChangeAction)
    end

    self.dayChangeAction = function()
        self.dayChangeAction = nil
        if self.plugin and self.plugin.activeKarendaView and self.plugin.activeKarendaView ~= self then
            return
        end
        self:_updateToday(DateUtils.todayKey())
    end
    UIManager:scheduleIn(DateUtils.secondsUntilNextDay(), self.dayChangeAction)
end

function CalendarScreen:_updateToday(today)
    if not DateUtils.isDateKey(today) then
        return false
    end

    local changed = self.today ~= today
    self.today = today
    if self.cursorFollowsToday then
        self.cursor = today
    end
    if changed and self[1] then
        self:_refresh()
    end
    if changed and self.detailViewer and self.detailEvent then
        self.detailViewer.text = eventDetails(
            self.detailEvent,
            self.subjects,
            self.personalGroups,
            self.today
        )
        self.detailViewer:reinit()
    end
    self:_scheduleTodayCheck()
    return changed
end

function CalendarScreen:_build()
    local screen_width = Screen:getWidth()
    local screen_height = Screen:getHeight()
    local navbar_widget, navbar_height = SurfaceNavigation.getNavbar()
    local available_height = math.max(
        screen_height - navbar_height,
        Size.item.height_large
    )
    self.navbarHeight = navbar_height
    self.active_widgets = navbar_widget and { navbar_widget } or nil
    self.dimen.w = screen_width
    self.dimen.h = available_height
    local side_padding = Size.padding.fullscreen
    local scrollbar_width = Size.line.medium
    local scrollbar_reserve = 3 * scrollbar_width
    local content_width = screen_width - 2 * side_padding - scrollbar_reserve
    local today = self.today
    local data = CalendarData.eventsForPeriod(self.snapshot, self.mode, self.cursor)
    local period_cursor = data.period and data.period.from or self.cursor
    local period_title = capitalize(CalendarData.periodLabel(self.mode, period_cursor))
    local title = self.mode == "agenda" and "Agenda" or period_title
    if title == "" then
        title = "Calendario"
    end

    local subtitle
    if self.mode == "agenda" then
        subtitle = table.concat({ period_title, countLabel(#data.events) }, " · ")
    else
        subtitle = table.concat({
            "Calendario",
            CalendarData.modeLabel(self.mode),
            countLabel(#data.events),
        }, " · ")
    end

    local titleBar = TitleBar:new{
        width = screen_width,
        fullscreen = true,
        align = "left",
        with_bottom_line = true,
        right_icon = "close",
        right_icon_tap_callback = function()
            self:onClose()
        end,
        title = title,
        subtitle = subtitle,
        close_callback = function()
            self:onClose()
        end,
        show_parent = self,
    }
    self.titleBar = titleBar
    self.refreshButton = SurfaceNavigation.attachRefreshButton(titleBar, {
        view = self,
        callback = function()
            self.plugin:refreshView(self, CalendarView, "calendario y notas")
        end,
    })
    local modeControl = self:_modeControl(screen_width)
    self.modeControl = modeControl
    local footer = self:_footer(screen_width)
    local body_height = available_height
        - titleBar:getSize().h
        - modeControl:getSize().h
        - footer:getSize().h
    if body_height < Size.item.height_large then
        body_height = Size.item.height_large
    end

    local paddedBody = HorizontalGroup:new{
        HorizontalSpan:new{ width = side_padding },
        self:_body(data, today, content_width),
        HorizontalSpan:new{ width = side_padding },
    }
    self.cropping_widget = ScrollableContainer:new{
        dimen = Geom:new{ w = screen_width, h = body_height },
        scroll_bar_width = scrollbar_width,
        show_parent = self,
        paddedBody,
    }
    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        padding = 0,
        VerticalGroup:new{
            titleBar,
            modeControl,
            self.cropping_widget,
            footer,
        },
    }
end

function CalendarScreen:_refresh()
    if self.cropping_widget and self.cropping_widget.onCloseWidget then
        self.cropping_widget:onCloseWidget()
    end
    self:clear()
    self.cropping_widget = nil
    self:_build()
    UIManager:setDirty(self, "ui")
end

function CalendarScreen:onShow()
    self:_scheduleTodayCheck()
    UIManager:setDirty(self, "flashui")
end

function CalendarScreen:onResume(today)
    self:_updateToday(today or DateUtils.todayKey())
end

function CalendarScreen:onGesture(gesture)
    if SurfaceNavigation.deferCloseOnNavbarTap(self, gesture) then
        return false
    end
    return InputContainer.onGesture(self, gesture)
end

function CalendarScreen:onClose()
    UIManager:close(self)
    return true
end

function CalendarScreen:onCloseWidget()
    local navbar_navigation = self.navbarNavigationInProgress == true
    SurfaceNavigation.cancelDeferredNavbarClose(self)
    self.active_widgets = nil
    if self.dayChangeAction then
        UIManager:unschedule(self.dayChangeAction)
        self.dayChangeAction = nil
    end
    if self.detailViewer then
        local viewer = self.detailViewer
        self.detailViewer = nil
        self.detailEvent = nil
        UIManager:close(viewer)
    end
    if self.cropping_widget and self.cropping_widget.onCloseWidget then
        self.cropping_widget:onCloseWidget()
    end
    self.plugin:onKarendaViewClosed(self)
    if not navbar_navigation then
        UIManager:setDirty(nil, "flashui")
    end
end

function CalendarScreen:onScreenResize()
    self.dimen = Screen:getSize():copy()
    self:_refresh()
    return false
end

function CalendarView.show(plugin, snapshot, simpleui_plugin, fm)
    local today = DateUtils.todayKey()
    local screen = CalendarScreen:new{
        plugin = plugin,
        snapshot = snapshot,
        mode = "agenda",
        cursor = today,
        today = today,
        cursorFollowsToday = true,
    }
    plugin:showKarendaView(screen, "calendar", simpleui_plugin, fm)
    UIManager:show(screen)
    return screen
end

CalendarView._eventDetails = eventDetails
CalendarView._eventMarker = eventMarker
CalendarView._eventMetadata = eventMetadata
CalendarView._eventCountdownLabel = eventCountdownLabel
CalendarView._CalendarScreen = CalendarScreen

return CalendarView
