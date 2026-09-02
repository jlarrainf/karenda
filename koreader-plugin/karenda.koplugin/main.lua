local WidgetContainer = require("ui/widget/container/widgetcontainer")
local InfoMessage = require("ui/widget/infomessage")
local InputDialog = require("ui/widget/inputdialog")
local Notification = require("ui/widget/notification")
local UIManager = require("ui/uimanager")
local _ = require("gettext")

local ApiClient = require("api_client")
local Config = require("config")
local HttpTransport = require("http_transport")
local PairingClient = require("pairing_client")
local Runtime = require("runtime")
local SnapshotStore = require("snapshot_store")
local SyncService = require("sync_service")
local CalendarView = require("calendar_view")
local NotesView = require("notes_view")
local SimpleUIIntegration = require("simpleui_integration")
local ScreensaverConfig = require("screensaver_config")
local ScreensaverIntegration = require("screensaver_integration")

local Karenda = WidgetContainer:extend{
    name = "karenda",
    is_doc_only = false,
}

function Karenda:init()
    self.config = Config
    self.store = SnapshotStore:new()
    self.activeKarendaView = nil
    ScreensaverIntegration.ensureInstalled()
    local transport = HttpTransport:new()
    self.apiClient = ApiClient:new{ transport = transport }
    self.pairingClient = PairingClient:new{ transport = transport }
    self.syncService = SyncService:new{
        config = self.config,
        store = self.store,
        apiClient = self.apiClient,
        runtime = Runtime,
    }
    SimpleUIIntegration.register(self)
    self.ui.menu:registerToMainMenu(self)
end

function Karenda:pair(code, callback)
    callback = callback or function() end
    local values, config_error = self.config.load()

    if config_error then
        callback({
            kind = "error",
            code = "STORE_ERROR",
            message = "No se pudo cargar la configuración de Karenda.",
        })
        return false
    end

    return self.pairingClient:pair(values.pairingUrl, code, function(result)
        if result.kind ~= "paired" then
            callback(result)
            return
        end

        local saved = self.config.save({ deviceToken = result.token })
        if not saved then
            callback({
                kind = "error",
                code = "STORE_ERROR",
                message = "No se pudo guardar la vinculación de Karenda.",
            })
            return
        end

        callback({
            kind = "paired",
            message = "Dispositivo vinculado. Ya puedes sincronizar Karenda.",
            metadata = result.metadata,
        })
    end)
end

function Karenda:showPairingDialog()
    local dialog
    dialog = InputDialog:new{
        title = _("Vincular dispositivo"),
        description = _("Genera un código de seis dígitos en Karenda Web y escríbelo aquí."),
        input_hint = _("Código de 6 dígitos"),
        input_type = "number",
        buttons = {
            {
                {
                    text = _("Cancelar"),
                    id = "close",
                    callback = function()
                        UIManager:close(dialog)
                    end,
                },
                {
                    text = _("Vincular"),
                    is_enter_default = true,
                    callback = function()
                        local code = tostring(dialog:getInputText() or ""):gsub("%s", "")
                        if not code:match("^%d%d%d%d%d%d$") then
                            UIManager:show(InfoMessage:new{
                                text = _("El código debe tener exactamente seis dígitos."),
                                timeout = 3,
                            })
                            return
                        end

                        UIManager:close(dialog)
                        UIManager:show(InfoMessage:new{
                            text = _("Vinculando dispositivo. Espera un momento."),
                            timeout = 1,
                        })
                        self:pair(code, function(result)
                            UIManager:show(InfoMessage:new{
                                text = result.message or _("No se pudo vincular el dispositivo."),
                                timeout = 4,
                            })
                        end)
                    end,
                },
            },
        },
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function Karenda:addToMainMenu(menu_items)
    ScreensaverConfig.addToMainMenu(menu_items, self.ui)
    menu_items.karenda = {
        text = _("Karenda"),
        sorting_hint = "more_tools",
        sub_item_table = {
            {
                text = _("Vincular dispositivo"),
                callback = function()
                    self:showPairingDialog()
                end,
            },
            {
                text = _("Sincronizar ahora"),
                callback = function()
                    self:sync(function(result)
                        UIManager:show(InfoMessage:new{
                            text = result.message or _("No se pudo sincronizar Karenda."),
                            timeout = 4,
                        })
                    end)
                end,
            },
        },
    }
end

function Karenda:sync(callback)
    return self.syncService:sync("manual", callback)
end

function Karenda:refreshView(view, viewModule, refresh_scope)
    if self.activeKarendaView ~= view then
        return false
    end

    refresh_scope = refresh_scope or "Karenda"
    local loading = InfoMessage:new{
        text = "Actualizando " .. refresh_scope .. "…",
        dismissable = false,
    }
    local loading_visible = true
    local function closeLoading()
        if loading_visible then
            loading_visible = false
            UIManager:close(loading)
        end
    end

    UIManager:show(loading)
    local started = self:sync(function(result)
        closeLoading()
        if self.activeKarendaView ~= view then
            return
        end

        if result.kind == "updated" or result.kind == "not_modified" then
            viewModule.show(self, result.snapshot)
            local completion_text
            if result.kind == "updated" then
                completion_text = "Se actualizaron el calendario y las notas."
            else
                completion_text = "El calendario y las notas ya estaban al día."
            end
            Notification:notify(completion_text, Notification.SOURCE_ALWAYS_SHOW)
            return
        end

        UIManager:show(InfoMessage:new{
            text = (result.message or "No se pudo actualizar el calendario y las notas.")
                .. "\n\nSe mantienen los datos locales.",
            timeout = 5,
        })
    end)
    if not started then
        closeLoading()
    end
    return started
end

function Karenda:showKarendaView(view, kind, simpleui_plugin, fm)
    if self.activeKarendaView and self.activeKarendaView ~= view then
        UIManager:close(self.activeKarendaView)
    end
    self.activeKarendaView = view
    self:setVisibleContext(kind)
    SimpleUIIntegration.trackIndicator(
        simpleui_plugin or SimpleUIIntegration.resolveSimpleUIPlugin(fm),
        kind,
        view
    )
end

function Karenda:onKarendaViewClosed(view)
    if self.activeKarendaView ~= view then
        return
    end
    self.activeKarendaView = nil
    self:clearVisibleContext()
end

function Karenda:openSnapshot(view_module, simpleui_plugin, fm)
    local cached = self:getCachedSnapshot()
    if cached and cached.snapshot then
        return view_module.show(self, cached.snapshot, simpleui_plugin, fm)
    end

    local loading = InfoMessage:new{
        text = "Sincronizando Karenda.",
        dismissable = false,
    }
    local loading_visible = true
    local function closeLoading()
        if loading_visible then
            loading_visible = false
            UIManager:close(loading)
        end
    end

    UIManager:show(loading)
    local started = self:sync(function(result)
        closeLoading()
        if result.kind == "updated" or result.kind == "not_modified" then
            view_module.show(self, result.snapshot, simpleui_plugin, fm)
            return
        end

        UIManager:show(InfoMessage:new{
            text = (result.message or "No se pudo sincronizar Karenda.")
                .. "\n\nNo hay datos locales para mostrar.",
            timeout = 5,
        })
    end)
    if not started then
        closeLoading()
    end
    return started
end

function Karenda:openCalendar(simpleui_plugin, fm)
    return self:openSnapshot(CalendarView, simpleui_plugin, fm)
end

function Karenda:openNotes(simpleui_plugin, fm)
    return self:openSnapshot(NotesView, simpleui_plugin, fm)
end

function Karenda:onResume()
    ScreensaverIntegration.ensureInstalled()
    self.syncService:onResume()
    if self.activeKarendaView and self.activeKarendaView.onResume then
        self.activeKarendaView:onResume()
    end
end

function Karenda:getCachedSnapshot()
    return self.store:load()
end

function Karenda:setVisibleContext(kind, noteId)
    return Runtime.setContext(kind, noteId)
end

function Karenda:clearVisibleContext()
    Runtime.clearContext()
end

function Karenda:getVisibleContext()
    return Runtime.getContext()
end

return Karenda
