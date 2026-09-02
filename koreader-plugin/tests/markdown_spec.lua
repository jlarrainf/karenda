package.path = "../karenda.koplugin/?.lua;" .. package.path

local Markdown = require("markdown")

describe("markdown", function()
    it("convierte formato compatible en texto legible", function()
        local text = Markdown.toPlainText([[# Unidad 1

**Repaso** y [documentación](https://example.com).

- Primer punto
> Una cita
]])

        assert.matches("Unidad 1", text)
        assert.matches("Repaso", text)
        assert.matches("documentación %(https://example%.com%)", text)
        assert.matches("%- Primer punto", text)
        assert.matches("%- Una cita", text)
        assert.is_nil(text:find("%*%*", 1, false))
    end)

    it("retira HTML ejecutable y enlaces no seguros", function()
        local text = Markdown.toPlainText([[<script>alert(1)</script>
[peligroso](javascript:alert(1))
<b>visible</b>]])

        assert.is_nil(text:find("script", 1, true))
        assert.is_nil(text:find("javascript", 1, true))
        assert.matches("peligroso", text)
        assert.matches("visible", text)
    end)

    it("normaliza formulas inline y de bloque a simbolos legibles", function()
        local text = Markdown.toPlainText([[Complejidad $O(|d| \cdot |p|)$.

        $$x^2 + \frac{a}{b} + \sum_{i=1}^{n} i$$]])

        assert.is_true(text:find("O(|d| · |p|)", 1, true) ~= nil)
        assert.is_true(text:find("x²", 1, true) ~= nil)
        assert.is_true(text:find("(a)/(b)", 1, true) ~= nil)
        assert.is_true(text:find("Σᵢ₌₁ⁿ", 1, true) ~= nil)
        assert.is_nil(text:find("$", 1, true))
        assert.is_nil(text:find("\\cdot", 1, true))
    end)

    it("convierte simbolos de conjuntos y exponentes de letras", function()
        local text = Markdown.toPlainText([[ $\Sigma \subseteq A \cup B \setminus C \equiv A \cap B$ y $L^C$ ]])

        assert.is_true(text:find("Σ", 1, true) ~= nil)
        assert.is_true(text:find("⊆", 1, true) ~= nil)
        assert.is_true(text:find("∪", 1, true) ~= nil)
        assert.is_true(text:find("∖", 1, true) ~= nil)
        assert.is_true(text:find("≡", 1, true) ~= nil)
        assert.is_true(text:find("∩", 1, true) ~= nil)
        assert.is_true(text:find("Lᶜ", 1, true) ~= nil)
    end)

    it("normaliza flechas parametrizadas y llaves literales", function()
        local text = Markdown.toPlainText([[ $\rho: p_0 \xrightarrow{a_1} p_1$ y $\harpoonup$ y $\Sigma = \{0, 1\}$ ]])

        assert.is_true(text:find("ρ: p₀ ⟶[a₁] p₁", 1, true) ~= nil)
        assert.is_true(text:find("⇀", 1, true) ~= nil)
        assert.is_true(text:find("Σ = {0, 1}", 1, true) ~= nil)
    end)
end)
