local screensaverPath = assert(arg[1], "Se requiere la ruta de karenda-screensaver.koplugin.")
local corePath = assert(arg[2], "Se requiere la ruta de karenda.koplugin.")
package.path = corePath .. "/?.lua;" .. package.path

local ContextBridge = require("context_bridge")
assert(ContextBridge.setContext("calendar") == false)
assert(ContextBridge.clearContext() == false)

package.path = screensaverPath .. "/?.lua;" .. package.path
local Context = require("karenda_screensaver_context")
Context.resetContext()
assert(Context.getContext().kind == "none")
assert(Context.setContext("calendar", nil, "calendar-view"))
assert(Context.getContext().kind == "calendar")
assert(Context.getContext().owner == "calendar-view")
assert(Context.clearContext("notes-view") == false)
assert(Context.getContext().kind == "calendar")
assert(Context.clearContext("calendar-view"))
assert(Context.getContext().kind == "none")

assert(ContextBridge.setContext("note", "note-1", "notes-view"))
local note_context = Context.getContext()
assert(note_context.kind == "note")
assert(note_context.noteId == "note-1")
assert(note_context.owner == "notes-view")
assert(ContextBridge.clearContext("notes-view"))
assert(Context.getContext().kind == "none")
assert(ContextBridge.setContext("invalid") == false)
print("screensaver_context_smoke: OK")
