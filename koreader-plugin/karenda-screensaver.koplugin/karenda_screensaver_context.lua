local Context = {
    value = {
        kind = "none",
        noteId = nil,
        owner = nil,
    },
}

local function isValidKind(kind)
    return kind == "calendar" or kind == "note" or kind == "none"
end

function Context.setContext(kind, noteId, owner)
    if not isValidKind(kind) then
        return false
    end

    Context.value.kind = kind
    Context.value.noteId = kind == "note" and noteId or nil
    Context.value.owner = kind == "none" and nil or owner
    return true
end

function Context.clearContext(owner)
    if owner ~= nil and Context.value.owner ~= nil and Context.value.owner ~= owner then
        return false
    end

    Context.setContext("none")
    return true
end

function Context.getContext()
    return {
        kind = Context.value.kind,
        noteId = Context.value.noteId,
        owner = Context.value.owner,
    }
end

function Context.resetContext()
    Context.setContext("none")
end

return Context
