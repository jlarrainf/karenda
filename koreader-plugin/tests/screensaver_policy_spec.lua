local pluginPath = assert(arg[1], "Se requiere la ruta de karenda-screensaver.koplugin.")
package.path = pluginPath .. "/?.lua;" .. package.path

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

    it("permite mostrar el libro aunque haya calendario o notas", function()
        assert.are.equal(
            "book",
            ScreensaverPolicy.resolve({ kind = "calendar" }, true, true, "book", "delegate")
        )
        assert.are.equal(
            "delegate",
            ScreensaverPolicy.resolve({ kind = "note" }, true, false, "book", "delegate")
        )
    end)

    it("permite dejar intacta la pantalla cuando no hay libro", function()
        assert.are.equal(
            "as_is",
            ScreensaverPolicy.resolve({ kind = "none" }, true, false, "preserve", "as_is")
        )
    end)
end)
