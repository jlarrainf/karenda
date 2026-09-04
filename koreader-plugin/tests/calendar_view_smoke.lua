local pluginPath = assert(arg[1], "Se requiere la ruta de karenda.koplugin.")
package.path = pluginPath .. "/?.lua;" .. package.path

require("setupkoenv")
G_defaults = require("luadefaults"):open()
local DataStorage = require("datastorage")
G_reader_settings = require("luasettings"):open(DataStorage:getDataDir() .. "/settings.reader.lua")

local Device = require("device")
require("document/canvascontext"):init(Device)
require("ui/bidi").setup(G_reader_settings:readSetting("language"))
local UIManager = require("ui/uimanager")

local CalendarView = require("calendar_view")
local NotesView = require("notes_view")
local SurfaceNavigation = require("surface_navigation")
local snapshot = {
    window = { from = "2026-08-23", to = "2026-10-15" },
    subjects = { { id = "subject-1", name = "Arquitectura de Software" } },
    personalGroups = { { id = "group-1", name = "Familia" } },
    events = {
        {
            id = "event-1",
            kind = "academic",
            title = "Entrega del informe de arquitectura distribuida",
            subjectId = "subject-1",
            startAt = "2026-09-01T09:00:00-04:00",
            endAt = "2026-09-01T10:30:00-04:00",
            allDay = false,
            status = "pending",
        },
        {
            id = "event-2",
            kind = "personal",
            title = "Cumpleaños familiar",
            personalGroupId = "group-1",
            startAt = "2026-09-03",
            endAt = "2026-09-03",
            allDay = true,
            status = "completed",
        },
        {
            id = "event-3",
            kind = "academic",
            title = "Control de lectura",
            subjectId = "subject-1",
            startAt = "2026-08-31T08:00:00-04:00",
            endAt = "2026-08-31T09:00:00-04:00",
            allDay = false,
            status = "pending",
        },
        {
            id = "event-4",
            kind = "academic",
            title = "Presentación del proyecto",
            subjectId = "subject-1",
            startAt = "2026-08-31T10:00:00-04:00",
            endAt = "2026-08-31T11:00:00-04:00",
            allDay = false,
            status = "pending",
        },
        {
            id = "event-5",
            kind = "personal",
            title = "Cita médica",
            personalGroupId = "group-1",
            startAt = "2026-08-31T13:00:00-04:00",
            endAt = "2026-08-31T14:00:00-04:00",
            allDay = false,
            status = "pending",
        },
        {
            id = "event-6",
            kind = "academic",
            title = "Entrega final",
            subjectId = "subject-1",
            startAt = "2026-08-31T18:00:00-04:00",
            endAt = "2026-08-31T19:00:00-04:00",
            allDay = false,
            status = "completed",
        },
    },
    notes = {
        {
            id = "note-1",
            targetType = "subject",
            targetId = "subject-1",
            title = "Plan de estudio",
            contentMarkdown = [[### Clase 00 - Repaso de fundamentos

Repasar **derivadas** y *relaciones*.

1. Primera tarea
2. Segunda tarea

- Punto visible

$$
\rho: p_0 \xrightarrow{a_1} p_1 \xrightarrow{a_2} p_2 \dots \xrightarrow{a_n} p_n
$$

$\Sigma = \{0, 1\}$

$\vdash_A$]],
            updatedAt = "2026-08-31T12:00:00-04:00",
        },
        {
            id = "note-2",
            targetType = "personal_group",
            targetId = "group-1",
            title = "Lista familiar",
            contentMarkdown = "Pendientes del grupo.",
            updatedAt = "2026-08-30T12:00:00-04:00",
        },
    },
}
local closed = false
local navigation = {
    calendar = 0,
    notes = 0,
    refresh = 0,
}
local plugin = {
    activeKarendaView = nil,
    setVisibleContext = function() end,
    openCalendar = function()
        navigation.calendar = navigation.calendar + 1
    end,
    openNotes = function()
        navigation.notes = navigation.notes + 1
    end,
    refreshView = function(self, view, viewModule, refresh_scope)
        navigation.refresh = navigation.refresh + 1
        assert(self.activeKarendaView == view)
        assert(viewModule)
        assert(refresh_scope == "calendario y notas")
    end,
    onKarendaViewClosed = function(self)
        self.activeKarendaView = nil
        closed = true
    end,
}

local screen = CalendarView._CalendarScreen:new{
    plugin = plugin,
    snapshot = snapshot,
    cursor = "2026-08-31",
    today = "2026-08-31",
    cursorFollowsToday = true,
}
plugin.activeKarendaView = screen
assert(screen.mode == "agenda")
assert(screen.cursorFollowsToday)
assert(screen.modeControl)
assert(screen.modeControl:getButtonById("mode-agenda"))
assert(screen.surfaceControl == nil)
assert(screen.refreshButton)
assert(screen.titleBar)
assert(screen.titleBar.right_icon == "close")
assert(screen.titleBar.refresh_button == screen.refreshButton)
assert(screen.titleBar.action_group)
assert(screen.titleBar.action_group[1] == screen.refreshButton)
assert(screen.titleBar.action_group[3] == screen.titleBar.right_button)
assert(screen.refreshButton.image.file:match("refresh%.svg$"))
assert(screen.refreshButton.overlap_offset == nil)
assert(screen[1][1][1] == screen.titleBar)
for index, label in ipairs({ "Agenda", "Mes", "Semana", "Día" }) do
    assert(screen.modeControl.buttons[1][index].text == label)
end
assert(screen.cropping_widget)
assert(screen[1]:getSize().w == Device.screen:getWidth())
assert(screen[1]:getSize().h == Device.screen:getHeight())
UIManager:show(screen)
UIManager:forceRePaint()
assert(screen.refreshButton.dimen.x < screen.titleBar.right_button.dimen.x)
assert(
    screen.refreshButton.dimen.x + screen.refreshButton:getSize().w
        <= screen.titleBar.right_button.dimen.x
)
assert(screen.dayChangeAction)
assert(screen.cropping_widget._max_scroll_offset_x == 0)

Device.screen:setRotationMode(1)
screen:onScreenResize()
UIManager:forceRePaint()
assert(screen[1]:getSize().w == Device.screen:getWidth())
assert(screen[1]:getSize().h == Device.screen:getHeight())
assert(screen.cropping_widget._max_scroll_offset_y > 0)
assert(screen.cropping_widget._max_scroll_offset_x == 0)
Device.screen:setRotationMode(0)
screen:onScreenResize()
UIManager:forceRePaint()

local function assertOneActiveMode()
    local active = 0
    for _, mode in ipairs({ "month", "week", "agenda", "day" }) do
        local button = screen.modeControl:getButtonById("mode-" .. mode)
        assert(button)
        if button.background then
            active = active + 1
        end
    end
    assert(active == 1)
end

assertOneActiveMode()
screen:_selectMode("month")
UIManager:forceRePaint()
assert(screen.mode == "month")
assertOneActiveMode()
screen:_selectMode("week")
UIManager:forceRePaint()
assert(screen.mode == "week")
assertOneActiveMode()
screen:_selectMode("agenda")
UIManager:forceRePaint()
assert(screen.mode == "agenda")
assert(screen.cursor == "2026-08-31")
assertOneActiveMode()
screen:_selectMode("day")
UIManager:forceRePaint()
assert(screen.mode == "day")
assertOneActiveMode()
assert(screen.modeControl)

screen:_selectMode("agenda")
screen.today = "2026-08-31"
screen.cursor = "2026-08-31"
screen.cursorFollowsToday = true
assert(screen:_moveCursor(1))
assert(screen.cursor == "2026-09-07")
assert(not screen.cursorFollowsToday)

assert(CalendarView._eventMetadata(snapshot.events[1], screen.subjects, screen.personalGroups):match("Estudiar"))
assert(CalendarView._eventCountdownLabel(snapshot.events[1], "2026-09-01") == "Hoy")
assert(CalendarView._eventCountdownLabel({
    startAt = "2026-08-31",
    endAt = "2026-09-02",
    allDay = true,
    status = "pending",
}, "2026-08-31") == "Faltan 2 días")
assert(CalendarView._eventCountdownLabel(snapshot.events[2], "2026-08-31") == "")
assert(CalendarView._eventCountdownLabel({
    startAt = "2026-08-29",
    endAt = "2026-08-29",
    allDay = true,
    status = "pending",
}, "2026-08-31") == "Vencido hace 2 días")
assert(CalendarView._eventDetails(
    snapshot.events[1],
    screen.subjects,
    screen.personalGroups,
    "2026-09-01"
):match("Tiempo restante: Hoy"))

screen.today = "2026-08-31"
screen.cursor = "2026-08-31"
screen.cursorFollowsToday = true
screen:onResume("2026-09-01")
assert(screen.today == "2026-09-01")
assert(screen.cursor == "2026-09-01")
screen.cursor = "2026-09-01"
screen.cursorFollowsToday = false
screen:onResume("2026-09-02")
assert(screen.today == "2026-09-02")
assert(screen.cursor == "2026-09-01")

screen:_showEvent(snapshot.events[1])
UIManager:forceRePaint()
assert(screen.detailViewer)
assert(screen.detailViewer.text:match("Tiempo restante: Vencido hace 1 día"))
screen:_updateToday("2026-09-03")
assert(screen.detailViewer.text:match("Tiempo restante: Vencido hace 2 días"))

screen.refreshButton.callback()
assert(navigation.notes == 0)
assert(navigation.refresh == 1)

screen:onClose()
UIManager:forceRePaint()
assert(closed)
assert(screen.detailViewer == nil)
assert(screen.dayChangeAction == nil)

closed = false
local notesScreen = NotesView._NotesScreen:new{
    plugin = plugin,
    snapshot = snapshot,
}
plugin.activeKarendaView = notesScreen
assert(notesScreen.surfaceControl == nil)
assert(notesScreen.refreshButton)
assert(notesScreen.filterControl)
assert(notesScreen.menu)
assert(notesScreen.titleBar.subtitle)
assert(notesScreen.titleBar.refresh_button == notesScreen.refreshButton)
assert(notesScreen.refreshButton.image.file:match("refresh%.svg$"))
assert(notesScreen.items[1].text == "Asignatura: Arquitectura de Software")
assert(notesScreen.items[2].text == "Plan de estudio")
assert(notesScreen.filterControl:getButtonById("notes-filter-all"))
assert(notesScreen.filterControl:getButtonById("notes-filter-subject-subject-1"))
assert(notesScreen.filterControl:getButtonById("notes-filter-group-group-1"))
assert(notesScreen.filterControl.subjectButtonTable)
assert(notesScreen.filterControl.subjectButtonTable.buttons[1][1].text == "Todos los ramos")
assert(#notesScreen.filterControl.subjectButtonTable.buttons[1] == 1)
assert(notesScreen.filterControl.subjectButtonTable.buttons[2][1].text == "Arquitectura de Software")
assert(notesScreen.filterControl.buttons[1][1].background)
notesScreen.filterControl:getButtonById("notes-filter-subject-subject-1").callback()
assert(notesScreen.selectedFilter.targetType == "subject")
assert(notesScreen.items[2].text == "Plan de estudio")
assert(notesScreen.filterControl:getButtonById("notes-filter-subject-subject-1").background)
assert(not notesScreen.filterControl:getButtonById("notes-filter-all").background)
notesScreen.filterControl:getButtonById("notes-filter-group-group-1").callback()
assert(notesScreen.selectedFilter.targetType == "personal_group")
assert(notesScreen.items[1].text == "Grupo: Familia")
assert(notesScreen.items[2].text == "Lista familiar")
assert(notesScreen.filterControl:getButtonById("notes-filter-group-group-1").background)
UIManager:show(notesScreen)
UIManager:forceRePaint()
notesScreen.filterControl:getButtonById("notes-filter-subject-subject-1").callback()
notesScreen.items[2].callback()
UIManager:forceRePaint()
local note_viewer = UIManager:getNthTopWidget()
assert(note_viewer.text_format == "html")
assert(not note_viewer.is_txt)
assert(note_viewer.text:find("<h1>Plan de estudio</h1>", 1, true))
assert(note_viewer.text:find("<strong>derivadas</strong>", 1, true))
assert(note_viewer.text:find('<ol style="margin-left: 1em; padding-left: 1em;">', 1, true))
assert(note_viewer.text:find('<ul style="margin-left: 1em; padding-left: 1em;">', 1, true))
local note_page = note_viewer.box_widget.document:openPage(1)
local ordered_marker_inset = false
for _, line in ipairs(note_page:getPageText()) do
    for _, word in ipairs(line) do
        if word.word == "1." and word.x0 > note_viewer.text_padding then
            ordered_marker_inset = true
        end
    end
end
note_page:close()
assert(ordered_marker_inset)
assert(note_viewer.text:find("<h3>Clase 00", 1, true))
assert(note_viewer.text:find("⟶", 1, true))
assert(note_viewer.text:find("<i>a</i><sub>1</sub>", 1, true))
assert(note_viewer.text:find("<i>a</i><sub>2</sub>", 1, true))
assert(note_viewer.text:find("<i>a</i><sub><i>n</i></sub>", 1, true))
assert(note_viewer.text:find("<sup style=\"font-size: 0.65em; line-height: 1;\"><i>a</i><sub>1</sub></sup>⟶", 1, true))
assert(note_viewer.text:find("Σ = {0, 1}", 1, true))
assert(note_viewer.text:find("⊢<sub><i>A</i></sub>", 1, true))
note_viewer:onClose()
UIManager:forceRePaint()
notesScreen.refreshButton.callback()
assert(navigation.calendar == 0)
assert(navigation.refresh == 2)
notesScreen:onClose()
UIManager:forceRePaint()
assert(closed)

local previous_bottombar = package.loaded["screens/sui_bottombar"]
local navbar_events = 0
local navbar_widget = {
    _navbar_bar = {},
    handleEvent = function(_, event)
        if event.handler == "onGesture" then
            navbar_events = navbar_events + 1
            return true
        end
    end,
}
local navbar_marker = { widget = navbar_widget }
package.loaded["screens/sui_bottombar"] = {
    TOTAL_H = function()
        return 96
    end,
}
table.insert(UIManager._window_stack, navbar_marker)

local navbar_screen = CalendarView._CalendarScreen:new{
    plugin = plugin,
    snapshot = snapshot,
    cursor = "2026-08-31",
    today = "2026-08-31",
    cursorFollowsToday = true,
}
assert(navbar_screen.navbarHeight == 96)
assert(navbar_screen.active_widgets[1] == navbar_widget)
assert(navbar_screen[1]:getSize().h == Device.screen:getHeight() - 96)
assert(navbar_screen:onGesture{
    pos = { y = Device.screen:getHeight() - 1 },
} == false)
assert(navbar_screen.navbarCloseAction)
SurfaceNavigation.cancelDeferredNavbarClose(navbar_screen)
UIManager:show(navbar_screen)
plugin.activeKarendaView = navbar_screen
UIManager:sendEvent(require("ui/event"):new("Gesture", {
    pos = { y = Device.screen:getHeight() - 1 },
}))
assert(navbar_events == 1)
assert(navbar_screen.navbarCloseAction)
local function closeNavbarScreenWithoutIntermediateFlash(screen)
    local intermediate_flashui = 0
    local original_set_dirty = UIManager.setDirty
    UIManager.setDirty = function(manager, widget, refreshtype, ...)
        if widget == nil and refreshtype == "flashui" then
            intermediate_flashui = intermediate_flashui + 1
        end
        return original_set_dirty(manager, widget, refreshtype, ...)
    end
    local close_action = assert(screen.navbarCloseAction)
    close_action()
    UIManager.setDirty = original_set_dirty
    assert(intermediate_flashui == 0)
    assert(screen.navbarNavigationInProgress == nil)
end

closeNavbarScreenWithoutIntermediateFlash(navbar_screen)
assert(closed)

local navbar_notes_screen = NotesView._NotesScreen:new{
    plugin = plugin,
    snapshot = snapshot,
}
assert(navbar_notes_screen.navbarHeight == 96)
assert(navbar_notes_screen.active_widgets[1] == navbar_widget)
assert(navbar_notes_screen[1]:getSize().h == Device.screen:getHeight() - 96)
closed = false
UIManager:show(navbar_notes_screen)
plugin.activeKarendaView = navbar_notes_screen
UIManager:sendEvent(require("ui/event"):new("Gesture", {
    pos = { y = Device.screen:getHeight() - 1 },
}))
assert(navbar_events == 2)
assert(navbar_notes_screen.navbarCloseAction)
closeNavbarScreenWithoutIntermediateFlash(navbar_notes_screen)
assert(closed)

table.remove(UIManager._window_stack, #UIManager._window_stack)
package.loaded["screens/sui_bottombar"] = previous_bottombar

local previous_file_manager = package.loaded["apps/filemanager/filemanager"]
local legacy_file_manager = {
    [1] = {
        [1] = {
            [2] = {
                onTapNavBar = function() end,
                getSize = function()
                    return { h = 72 }
                end,
            },
        },
    },
}
package.loaded["apps/filemanager/filemanager"] = {
    instance = legacy_file_manager,
}
table.insert(UIManager._window_stack, {
    widget = legacy_file_manager,
})
assert(select(1, SurfaceNavigation.getNavbar()) == legacy_file_manager)
assert(SurfaceNavigation.getBottomInset() == 72)
table.remove(UIManager._window_stack, #UIManager._window_stack)
package.loaded["apps/filemanager/filemanager"] = previous_file_manager
print("Smoke de vista de calendario: correcto.")
