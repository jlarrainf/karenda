package.path = "../karenda.koplugin/?.lua;" .. package.path

local ScreensaverPolicy = require("screensaver_policy")

describe("screensaver_policy", function()
    it("delega todo cuando la función está desactivada", function()
        assert.are.equal("delegate", ScreensaverPolicy.resolve({ kind = "calendar" }, false, true, true))
        assert.are.equal("delegate", ScreensaverPolicy.resolve({ kind = "note" }, false, true, true))
        assert.are.equal("delegate", ScreensaverPolicy.resolve({ kind = "none" }, false, true, true))
    end)

    it("prioriza dejar calendario y notas intactos sobre el documento cuando está activa", function()
        local ui_has_document = true

        assert.are.equal(
            "as_is",
            ScreensaverPolicy.resolve({ kind = "calendar" }, true, ui_has_document, true)
        )
        assert.are.equal(
            "as_is",
            ScreensaverPolicy.resolve({ kind = "note" }, true, ui_has_document, true)
        )
    end)

    it("elige la pantalla de libro solo cuando hay documento y widget disponible", function()
        assert.are.equal("book", ScreensaverPolicy.resolve({ kind = "none" }, true, true, true))
        assert.are.equal("delegate", ScreensaverPolicy.resolve({ kind = "none" }, true, true, false))
        assert.are.equal("delegate", ScreensaverPolicy.resolve({ kind = "none" }, true, false, true))
    end)

    it("delega fuera de las superficies de Karenda", function()
        assert.are.equal("delegate", ScreensaverPolicy.resolve({ kind = "none" }, true, false, false))
        assert.are.equal("delegate", ScreensaverPolicy.resolve(nil, true, false, false))
    end)
end)
