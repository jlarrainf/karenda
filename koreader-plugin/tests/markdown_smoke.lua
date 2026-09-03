local pluginPath = assert(arg[1], "Se requiere la ruta de karenda.koplugin.")
require("setupkoenv")
package.path = pluginPath .. "/?.lua;" .. package.path

local Markdown = require("markdown")
local text = Markdown.toPlainText([[Complejidad $O(|d| \cdot |p|)$ y $|d|$.

$$x^2 + \frac{a}{b} + \sum_{i=1}^{n} i$$]])

assert(text:find("O(|d| · |p|)", 1, true))
assert(text:find("y |d|", 1, true))
assert(text:find("x²", 1, true))
assert(text:find("(a)/(b)", 1, true))
assert(text:find("Σᵢ₌₁ⁿ", 1, true))
assert(not text:find("$", 1, true))
assert(not text:find("\\cdot", 1, true))

local symbols = Markdown.toPlainText([[ $\Sigma \subseteq A \cup B \setminus C \equiv A \cap B$ y $L^C$ ]])
assert(symbols:find("Σ", 1, true))
assert(symbols:find("⊆", 1, true))
assert(symbols:find("∪", 1, true))
assert(symbols:find("∖", 1, true))
assert(symbols:find("≡", 1, true))
assert(symbols:find("∩", 1, true))
assert(symbols:find("Lᶜ", 1, true))

local arrows = Markdown.toPlainText([[ $\rho: p_0 \xrightarrow{a_1} p_1 \xrightarrow{a_2} p_2 \dots \xrightarrow{a_n} p_n$ ]])
assert(arrows:find("ρ: p₀ ⟶[a₁] p₁ ⟶[a₂] p₂ … ⟶[aₙ] pₙ", 1, true))
assert(Markdown.toPlainText([[ $\harpoonup$ ]]):find("⇀", 1, true))
local brace_text = Markdown.toPlainText([[ $\Sigma = \{0, 1\}$ ]])
assert(brace_text:find("Σ = {0, 1}", 1, true))
local turnstile_text = Markdown.toPlainText([[$\vdash_A$]])
assert(turnstile_text:find("⊢_A", 1, true))

local rich = Markdown.toHtml([[### Clase 00 - Repaso de fundamentos

Texto **en negrita** y *en cursiva*.

Complejidad $O(|d| \cdot |p|)$ y complemento $L^C$.

$$\Sigma \subseteq A \cup B \setminus C \equiv A \cap B$$

<script>alert(1)</script>
[Enlace peligroso](javascript:alert(1))]])

assert(rich:find("<h3>Clase 00", 1, true))
assert(rich:find("<strong>en negrita</strong>", 1, true))
assert(rich:find("<em>en cursiva</em>", 1, true))
assert(rich:find("<i>O</i>", 1, true))
assert(rich:find("<i>d</i>", 1, true))
assert(rich:find("<sup><i>C</i></sup>", 1, true))
assert(rich:find("Σ", 1, true))
assert(rich:find("⊆", 1, true))
assert(rich:find("∪", 1, true))
assert(rich:find("∖", 1, true))
assert(rich:find("≡", 1, true))
assert(rich:find("∩", 1, true))
assert(rich:find("<div style=", 1, true))
assert(not rich:find("$", 1, true))
assert(not rich:find("\\Sigma", 1, true))
assert(not rich:find("\\subseteq", 1, true))
assert(not rich:find("<script", 1, true))
assert(not rich:find("javascript:", 1, true))
assert(not rich:find("<a ", 1, true))

local arrow_html = Markdown.toHtml([[$$
\rho: p_0 \xrightarrow{a_1} p_1 \xrightarrow{a_2} p_2 \dots \xrightarrow{a_n} p_n
$$]])
local harpoon_html = Markdown.toHtml([[$\harpoonup$]])
assert(arrow_html:find("⟶", 1, true))
assert(arrow_html:find("<i>a</i><sub>1</sub>", 1, true))
assert(arrow_html:find("<i>a</i><sub>2</sub>", 1, true))
assert(arrow_html:find("<i>a</i><sub><i>n</i></sub>", 1, true))
assert(arrow_html:find("<sup style=\"font-size: 0.65em; line-height: 1;\"><i>a</i><sub>1</sub></sup>⟶", 1, true))
assert(arrow_html:find("white-space: nowrap", 1, true))
assert(not arrow_html:find("display: block", 1, true))
assert(not arrow_html:find("xrightarrow", 1, true))
assert(harpoon_html:find("⇀", 1, true))
assert(not harpoon_html:find("harpoonup", 1, true))

local brace_html = Markdown.toHtml([[$\Sigma = \{0, 1\}$]])
assert(brace_html:find("Σ = {0, 1}", 1, true))
assert(not brace_html:find("\\{", 1, true))

local turnstile_html = Markdown.toHtml([[$\vdash_A$]])
assert(turnstile_html:find("⊢<sub><i>A</i></sub>", 1, true))
assert(not turnstile_html:find("vdash", 1, true))

local unsafe_fence = Markdown.toHtml([[```" onload="alert(1)
texto sin atributos
```]])
assert(not unsafe_fence:find("onload", 1, true))

local unsafe_reference = Markdown.toHtml([[ [Referencia][maliciosa]
[maliciosa]: javascript:alert(1) ]])
assert(not unsafe_reference:find("<a ", 1, true))
assert(not unsafe_reference:find("javascript:", 1, true))

local table_html = Markdown.toHtml([[| Tema | Estado |
| --- | :---: |
| **Rango** | *Listo* |]])
assert(table_html:find("<table", 1, true))
assert(table_html:find("<th", 1, true))
assert(table_html:find("<strong>Rango</strong>", 1, true))
assert(table_html:find("<em>Listo</em>", 1, true))

local multiline = Markdown.toHtml([[$$
\Sigma_{i=1}^{n}
$$]])
assert(multiline:find("<div style=", 1, true))
assert(multiline:find("<sub>", 1, true))
assert(multiline:find("<sup>", 1, true))
assert(not multiline:find("$", 1, true))
print("Smoke de Markdown: correcto.")
