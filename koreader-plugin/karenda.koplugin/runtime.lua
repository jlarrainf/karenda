local Runtime = {
    context = {
        kind = "none",
        noteId = nil,
    },
    syncInFlight = false,
}

function Runtime.setContext(kind, noteId)
    if kind ~= "calendar" and kind ~= "note" and kind ~= "none" then
        return false
    end

    Runtime.context.kind = kind
    Runtime.context.noteId = kind == "note" and noteId or nil
    return true
end

function Runtime.clearContext()
    Runtime.setContext("none")
end

function Runtime.getContext()
    return {
        kind = Runtime.context.kind,
        noteId = Runtime.context.noteId,
    }
end

function Runtime.beginSync()
    if Runtime.syncInFlight then
        return false
    end
    Runtime.syncInFlight = true
    return true
end

function Runtime.finishSync()
    Runtime.syncInFlight = false
end

return Runtime
