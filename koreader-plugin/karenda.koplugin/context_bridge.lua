local ContextBridge = {}

local function getContextModule()
    local ok, context = pcall(require, "karenda_screensaver_context")
    if not ok or type(context) ~= "table" then
        return nil
    end
    return context
end

function ContextBridge.setContext(kind, noteId, owner)
    local context = getContextModule()
    if not context or type(context.setContext) ~= "function" then
        return false
    end
    return context.setContext(kind, noteId, owner) == true
end

function ContextBridge.clearContext(owner)
    local context = getContextModule()
    if not context or type(context.clearContext) ~= "function" then
        return false
    end
    return context.clearContext(owner) == true
end

return ContextBridge
