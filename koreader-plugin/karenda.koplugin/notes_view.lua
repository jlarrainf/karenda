local Blitbuffer = require("ffi/blitbuffer")
local ButtonTable = require("ui/widget/buttontable")
local Device = require("device")
local FrameContainer = require("ui/widget/container/framecontainer")
local Font = require("ui/font")
local InputContainer = require("ui/widget/container/inputcontainer")
local Menu = require("ui/widget/menu")
local Size = require("ui/size")
local TextViewer = require("ui/widget/textviewer")
local TitleBar = require("ui/widget/titlebar")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalSpan = require("ui/widget/verticalspan")
local VerticalGroup = require("ui/widget/verticalgroup")
local _ = require("gettext")

local Markdown = require("markdown")
local SurfaceNavigation = require("surface_navigation")

local Screen = Device.screen
local NotesView = {}
local ALL_SUBJECTS = "all_subjects"

local function indexById(rows)
    local result = {}
    for _, row in ipairs(rows or {}) do
        result[row.id] = row
    end
    return result
end

local function targetLabel(note, subjects, personalGroups)
    if note.targetType == "subject" then
        local subject = subjects[note.targetId]
        return subject and "Asignatura: " .. subject.name or "Asignatura"
    end

    local group = personalGroups[note.targetId]
    return group and "Grupo: " .. group.name or "Grupo personal"
end

local function dateLabel(value)
    if type(value) ~= "string" then
        return ""
    end
    local year, month, day = value:match("^(%d%d%d%d)%-(%d%d)%-(%d%d)")
    if not year then
        return value
    end
    return string.format("%s/%s/%s", day, month, year)
end

local function noteSortKey(note, subjects, personalGroups)
    return targetLabel(note, subjects, personalGroups):lower()
        .. "\0" .. tostring(note.title or ""):lower()
        .. "\0" .. tostring(note.id or "")
end

local function sortedRows(rows)
    local result = {}
    for _, row in ipairs(rows or {}) do
        result[#result + 1] = row
    end
    table.sort(result, function(left, right)
        return tostring(left.name or ""):lower() < tostring(right.name or ""):lower()
            or (
                tostring(left.name or ""):lower() == tostring(right.name or ""):lower()
                and tostring(left.id or "") < tostring(right.id or "")
            )
    end)
    return result
end

local function filtersEqual(left, right)
    return left.targetType == right.targetType and left.targetId == right.targetId
end

local function filterButtonRows(entries, columns)
    local rows = {}
    local row = {}
    for _, entry in ipairs(entries) do
        row[#row + 1] = entry
        if #row == columns then
            rows[#rows + 1] = row
            row = {}
        end
    end
    if #row > 0 then
        rows[#rows + 1] = row
    end
    return rows
end

local NotesFilterControl = InputContainer:extend{
    width = nil,
    subjects = nil,
    personalGroups = nil,
    selectedFilter = nil,
    onSelect = nil,
    show_parent = nil,
}

function NotesFilterControl:_buttonEntry(id, text, filter)
    return {
        id = id,
        text = text,
        font_size = 15,
        font_bold = filtersEqual(filter, self.selectedFilter),
        height = Size.item.height_large,
        align = "left",
        avoid_text_truncation = true,
        background = filtersEqual(filter, self.selectedFilter)
            and Blitbuffer.COLOR_LIGHT_GRAY
            or nil,
        callback = function()
            self.onSelect(filter)
        end,
    }
end

function NotesFilterControl:_addSection(content, label, entries, columns, firstFullWidth)
    if #entries == 0 then
        return
    end

    content[#content + 1] = TextWidget:new{
        text = label,
        face = Font:getFace("smallinfofont", 13),
        bold = true,
        padding = 0,
        max_width = self.width,
    }
    content[#content + 1] = VerticalSpan:new{ width = Size.span.vertical_default }

    local rows
    if firstFullWidth then
        rows = { { entries[1] } }
        local remaining = {}
        for index = 2, #entries do
            remaining[#remaining + 1] = entries[index]
        end
        for _, row in ipairs(filterButtonRows(remaining, columns)) do
            rows[#rows + 1] = row
        end
    else
        rows = filterButtonRows(entries, columns)
    end
    local table_widget = ButtonTable:new{
        width = self.width,
        show_parent = self.show_parent or self,
        zero_sep = true,
        buttons = rows,
    }
    content[#content + 1] = table_widget
    for id, button in pairs(table_widget.button_by_id) do
        self.buttonById[id] = button
    end
    for _, row in ipairs(rows) do
        self.buttons[#self.buttons + 1] = row
    end

    if label == "ASIGNATURAS" then
        self.subjectButtonTable = table_widget
    else
        self.groupButtonTable = table_widget
    end
end

function NotesFilterControl:init()
    self.buttonById = {}
    self.buttons = {}
    self.subjectButtonTable = nil
    self.groupButtonTable = nil

    local subjectEntries = {
        self:_buttonEntry("notes-filter-all", "Todos los ramos", {
            targetType = ALL_SUBJECTS,
        }),
    }
    for _, subject in ipairs(self.subjects or {}) do
        subjectEntries[#subjectEntries + 1] = self:_buttonEntry(
            "notes-filter-subject-" .. tostring(subject.id),
            subject.name,
            { targetType = "subject", targetId = subject.id }
        )
    end

    local groupEntries = {}
    for _, group in ipairs(self.personalGroups or {}) do
        groupEntries[#groupEntries + 1] = self:_buttonEntry(
            "notes-filter-group-" .. tostring(group.id),
            group.name,
            { targetType = "personal_group", targetId = group.id }
        )
    end

    local content = VerticalGroup:new{ align = "left" }
    self:_addSection(content, "ASIGNATURAS", subjectEntries, 2, true)
    if #groupEntries > 0 then
        content[#content + 1] = VerticalSpan:new{ width = Size.span.vertical_large }
        self:_addSection(content, "GRUPOS PERSONALES", groupEntries, 2)
    end
    self[1] = content
    self.dimen = content:getSize()
end

function NotesFilterControl:getButtonById(id)
    return self.buttonById[id]
end

function NotesFilterControl:setSelectedFilter(selectedFilter)
    self.selectedFilter = selectedFilter
    self:clear()
    self:init()
end

local function filterMatches(note, selectedFilter)
    if selectedFilter.targetType == ALL_SUBJECTS then
        return note.targetType == "subject"
    end
    return note.targetType == selectedFilter.targetType
        and note.targetId == selectedFilter.targetId
end

local function filterLabel(selectedFilter, subjects, personalGroups)
    if selectedFilter.targetType == ALL_SUBJECTS then
        return "Todos los ramos"
    end
    return targetLabel({
        targetType = selectedFilter.targetType,
        targetId = selectedFilter.targetId,
    }, subjects, personalGroups)
end

local function countFilteredNotes(snapshot, selectedFilter)
    local count = 0
    for _, note in ipairs(snapshot.notes or {}) do
        if filterMatches(note, selectedFilter) then
            count = count + 1
        end
    end
    return count
end

local function countLabel(count)
    return count == 1 and "1 nota" or tostring(count) .. " notas"
end

local function noteDetails(note, subjects, personalGroups)
    local content = Markdown.toPlainText(note.contentMarkdown)
    if content == "" then
        content = _("La nota no tiene contenido.")
    end
    return table.concat({
        note.title,
        targetLabel(note, subjects, personalGroups),
        "Actualizada: " .. dateLabel(note.updatedAt),
        "",
        content,
    }, "\n")
end

local function noteDetailsHtml(note, subjects, personalGroups)
    local content = Markdown.toHtml(note.contentMarkdown)
    if content == "" then
        content = "<p>" .. Markdown.escapeHtml(_("La nota no tiene contenido.")) .. "</p>"
    end
    return table.concat({
        "<h1>" .. Markdown.escapeHtml(note.title) .. "</h1>",
        "<p><strong>" .. Markdown.escapeHtml(targetLabel(note, subjects, personalGroups))
            .. "</strong><br />Actualizada: "
            .. Markdown.escapeHtml(dateLabel(note.updatedAt)) .. "</p>",
        content,
    }, "\n")
end

local function buildItems(snapshot, subjects, personalGroups, plugin, selectedFilter)
    local notes = {}
    for _, note in ipairs(snapshot.notes or {}) do
        if filterMatches(note, selectedFilter) then
            notes[#notes + 1] = note
        end
    end
    table.sort(notes, function(left, right)
        return noteSortKey(left, subjects, personalGroups)
            < noteSortKey(right, subjects, personalGroups)
    end)

    local items = {}
    local previousTarget
    for _, note in ipairs(notes) do
        local currentNote = note
        local target = targetLabel(currentNote, subjects, personalGroups)
        if target ~= previousTarget then
            items[#items + 1] = {
                text = target,
                enabled = false,
                bold = true,
            }
            previousTarget = target
        end
        items[#items + 1] = {
            text = currentNote.title,
            mandatory = dateLabel(currentNote.updatedAt),
            callback = function()
                plugin:setVisibleContext("note", currentNote.id)
                UIManager:show(TextViewer:new{
                    title = currentNote.title,
                    text = noteDetailsHtml(currentNote, subjects, personalGroups),
                    text_format = "html",
                    close_callback = function()
                        plugin:setVisibleContext("note")
                    end,
                })
            end,
        }
    end

    if #items == 0 then
        items[1] = {
            text = selectedFilter.targetType == ALL_SUBJECTS
                and "No hay notas de asignaturas."
                or "No hay notas para este destino.",
            enabled = false,
        }
    end
    return items
end

local NotesScreen = InputContainer:extend{
    plugin = nil,
    snapshot = nil,
    subjects = nil,
    personalGroups = nil,
    subjectList = nil,
    personalGroupList = nil,
    selectedFilter = nil,
    items = nil,
    menu = nil,
    titleBar = nil,
    refreshButton = nil,
    filterControl = nil,
    navbarHeight = 0,
    contentGroup = nil,
    covers_fullscreen = false,
    stop_events_propagation = true,
}

function NotesScreen:init()
    self.dimen = Screen:getSize():copy()
    self.subjects = indexById(self.snapshot.subjects)
    self.personalGroups = indexById(self.snapshot.personalGroups)
    self.subjectList = sortedRows(self.snapshot.subjects)
    self.personalGroupList = sortedRows(self.snapshot.personalGroups)
    self.selectedFilter = self.selectedFilter or { targetType = ALL_SUBJECTS }
    self.items = buildItems(
        self.snapshot,
        self.subjects,
        self.personalGroups,
        self.plugin,
        self.selectedFilter
    )
    if Device:hasKeys() then
        self.key_events.Close = { { Device.input.group.Back } }
    end
    self:_build()
end

function NotesScreen:_filterControl(width)
    return NotesFilterControl:new{
        width = width,
        subjects = self.subjectList,
        personalGroups = self.personalGroupList,
        selectedFilter = self.selectedFilter,
        show_parent = self,
        onSelect = function(selectedFilter)
            self:_selectFilter(selectedFilter)
        end,
    }
end

function NotesScreen:_updateTitle()
    if not self.titleBar then
        return
    end
    self.titleBar:setSubTitle(
        filterLabel(self.selectedFilter, self.subjects, self.personalGroups)
            .. " · " .. countLabel(countFilteredNotes(self.snapshot, self.selectedFilter)),
        true
    )
end

function NotesScreen:_selectFilter(selectedFilter)
    if self.selectedFilter.targetType == selectedFilter.targetType
        and self.selectedFilter.targetId == selectedFilter.targetId
    then
        return true
    end

    self.selectedFilter = selectedFilter
    self.items = buildItems(
        self.snapshot,
        self.subjects,
        self.personalGroups,
        self.plugin,
        self.selectedFilter
    )
    self:_updateTitle()
    self.filterControl:setSelectedFilter(self.selectedFilter)
    self.menu:switchItemTable(nil, self.items)
    UIManager:setDirty(self, "ui")
    return true
end

function NotesScreen:_build()
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
    local subtitle = filterLabel(self.selectedFilter, self.subjects, self.personalGroups)
        .. " · " .. countLabel(countFilteredNotes(self.snapshot, self.selectedFilter))
    local titleBar = TitleBar:new{
        width = screen_width,
        fullscreen = true,
        align = "left",
        with_bottom_line = true,
        right_icon = "close",
        right_icon_tap_callback = function()
            self:onClose()
        end,
        title = "Notas",
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
            self.plugin:refreshView(self, NotesView, "calendario y notas")
        end,
    })
    self:_updateTitle()
    local filterControl = self:_filterControl(screen_width)
    self.filterControl = filterControl
    local menu_height = available_height
        - titleBar:getSize().h
        - filterControl:getSize().h
    if menu_height < Size.item.height_large then
        menu_height = Size.item.height_large
    end

    local menu = Menu:new{
        width = screen_width,
        height = menu_height,
        no_title = true,
        is_popout = false,
        item_table = self.items,
        items_max_lines = 2,
        show_parent = self,
    }
    self.menu = menu
    self.contentGroup = VerticalGroup:new{
        titleBar,
        filterControl,
        menu,
    }
    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        padding = 0,
        self.contentGroup,
    }
end

function NotesScreen:onShow()
    UIManager:setDirty(self, "flashui")
end

function NotesScreen:onClose()
    UIManager:close(self)
    return true
end

function NotesScreen:onGesture(gesture)
    if SurfaceNavigation.deferCloseOnNavbarTap(self, gesture) then
        return false
    end
    return InputContainer.onGesture(self, gesture)
end

function NotesScreen:onCloseWidget()
    local navbar_navigation = self.navbarNavigationInProgress == true
    SurfaceNavigation.cancelDeferredNavbarClose(self)
    self.active_widgets = nil
    self.plugin:onKarendaViewClosed(self)
    if not navbar_navigation then
        UIManager:setDirty(nil, "flashui")
    end
end

function NotesScreen:onScreenResize()
    self.dimen = Screen:getSize():copy()
    self:clear()
    self:_build()
    UIManager:setDirty(self, "ui")
    return false
end

function NotesView.show(plugin, snapshot, simpleui_plugin, fm)
    local screen = NotesScreen:new{
        plugin = plugin,
        snapshot = snapshot,
    }
    plugin:showKarendaView(screen, "note", simpleui_plugin, fm)
    UIManager:show(screen)
    return screen
end

NotesView._noteDetails = noteDetails
NotesView._noteDetailsHtml = noteDetailsHtml
NotesView._targetLabel = targetLabel
NotesView._NotesScreen = NotesScreen

return NotesView
