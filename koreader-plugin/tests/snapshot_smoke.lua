package.path = "../karenda.koplugin/?.lua;" .. package.path
package.path = "/home/juani/lib/koreader/common/?.lua;" .. package.path
package.cpath = "/home/juani/lib/koreader/common/?.so;" .. package.cpath

local json = require("json")
local SnapshotMapper = require("snapshot_mapper")
local file = assert(io.open("fixtures/snapshot-valid.json", "rb"))
local payload = assert(json.decode(file:read("*a")))
file:close()

local snapshot, err = SnapshotMapper.map(payload)
assert(snapshot, err and err.message)
assert(snapshot.generatedAt == "2026-08-30T23:00:00.000Z")
assert(snapshot.events[2].kind == "personal")
assert(snapshot.events[2].subjectId == nil)
assert(snapshot.events[2].endAt == "2026-09-08")
print("snapshot mapper smoke: ok")
