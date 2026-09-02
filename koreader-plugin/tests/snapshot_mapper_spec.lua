package.path = "../karenda.koplugin/?.lua;" .. package.path

local SnapshotMapper = require("snapshot_mapper")
local json = require("json")

local function validSnapshot()
    return {
        schema_version = 1,
        snapshot_id = "fixture-1",
        generated_at = "2026-08-30T23:00:00.000Z",
        timezone = "America/Santiago",
        window = {
            from = "2026-08-23",
            to = "2027-02-26",
        },
        subjects = {
            {
                id = "subject-1",
                name = "Análisis de Datos",
                code = "DAA",
                abbreviation = "DAA",
                color = "#2F625A",
                updated_at = "2026-08-30T20:00:00.000Z",
            },
        },
        personal_groups = {},
        events = {
            {
                id = "event-1",
                kind = "academic",
                title = "Control 3",
                subject_id = "subject-1",
                personal_group_id = nil,
                start_at = "2026-09-04T13:00:00Z",
                end_at = "2026-09-04T15:00:00Z",
                all_day = false,
                status = "pending",
                location = nil,
                description = nil,
                updated_at = "2026-08-30T20:00:00.000Z",
            },
        },
        notes = {},
    }
end

describe("snapshot_mapper", function()
    it("convierte snake_case a modelos internos", function()
        local snapshot, err = SnapshotMapper.map(validSnapshot())

        assert.is_nil(err)
        assert.are.equal("fixture-1", snapshot.snapshotId)
        assert.are.equal("subject-1", snapshot.events[1].subjectId)
        assert.are.equal("2026-09-04T13:00:00Z", snapshot.events[1].startAt)
    end)

    it("acepta timestamps RFC 3339 con milisegundos y zona Z", function()
        local payload = validSnapshot()
        payload.events[1].updated_at = "2026-09-04T13:00:00.123Z"

        local snapshot, err = SnapshotMapper.map(payload)

        assert.is_nil(err)
        assert.are.equal("2026-09-04T13:00:00.123Z", snapshot.events[1].updatedAt)
    end)

    it("trata null JSON como campos opcionales ausentes", function()
        local payload = validSnapshot()
        local event = payload.events[1]
        event.kind = "personal"
        event.subject_id = json.util.null
        event.personal_group_id = json.util.null
        event.start_at = "2026-09-04"
        event.end_at = json.util.null
        event.all_day = true
        event.location = json.util.null
        event.description = json.util.null

        local snapshot, err = SnapshotMapper.map(payload)

        assert.is_nil(err)
        assert.is_nil(snapshot.events[1].subjectId)
        assert.is_nil(snapshot.events[1].endAt)
        assert.is_nil(snapshot.events[1].location)
    end)

    it("rechaza referencias de eventos que no están en el catálogo", function()
        local payload = validSnapshot()
        payload.events[1].subject_id = "missing-subject"

        local snapshot, err = SnapshotMapper.map(payload)

        assert.is_nil(snapshot)
        assert.are.equal("INVALID_SNAPSHOT", err.code)
    end)

    it("rechaza una versión de contrato desconocida", function()
        local payload = validSnapshot()
        payload.schema_version = 2

        local snapshot, err = SnapshotMapper.map(payload)

        assert.is_nil(snapshot)
        assert.are.equal("INVALID_SNAPSHOT", err.code)
    end)

    it("rechaza filas que no son objetos sin lanzar una excepción", function()
        local payload = validSnapshot()
        payload.events[1] = "invalid-row"

        local snapshot, err = SnapshotMapper.map(payload)

        assert.is_nil(snapshot)
        assert.are.equal("INVALID_SNAPSHOT", err.code)
    end)
end)
