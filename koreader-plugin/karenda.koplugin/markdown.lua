local Markdown = {}
local MATH_BAR_TOKEN = "\1"
local MATH_XARROW_START = "\2"
local MATH_XARROW_END = "\3"
local MATH_LITERAL_LEFT_BRACE = "\4"
local MATH_LITERAL_RIGHT_BRACE = "\5"
local MATH_TOKEN_PREFIX = "KarendaMathToken"
local TABLE_PIPE_TOKEN = "KarendaTablePipe"
local TABLE_TOKEN_PREFIX = "KarendaTableToken"

local function trim(value)
    value = value:gsub("^%s+", "")
    value = value:gsub("%s+$", "")
    return value
end

local math_replacements = {
    { "\\xLeftrightarrow", "⇔" },
    { "\\xRightarrow", "⇒" },
    { "\\xLeftarrow", "⇐" },
    { "\\xleftrightarrow", "↔" },
    { "\\xleftarrow", "←" },
    { "\\xrightarrow", "⟶" },
    { "\\xhookleftarrow", "↩" },
    { "\\xhookrightarrow", "↪" },
    { "\\xmapsto", "↦" },
    { "\\rightleftharpoons", "⇌" },
    { "\\leftrightharpoons", "⇋" },
    { "\\rightharpoonup", "⇀" },
    { "\\leftharpoonup", "↼" },
    { "\\rightharpoondown", "⇁" },
    { "\\leftharpoondown", "↽" },
    { "\\harpoonup", "⇀" },
    { "\\harpoondown", "⇁" },
    { "\\mapsto", "↦" },
    { "\\longmapsto", "⟼" },
    { "\\not\\in", "∉" },
    { "\\notin", "∉" },
    { "\\not\\subseteq", "⊈" },
    { "\\not\\supseteq", "⊉" },
    { "\\subsetneq", "⊊" },
    { "\\supsetneq", "⊋" },
    { "\\subseteq", "⊆" },
    { "\\supseteq", "⊇" },
    { "\\subset", "⊂" },
    { "\\supset", "⊃" },
    { "\\setminus", "∖" },
    { "\\backslash", "∖" },
    { "\\emptyset", "∅" },
    { "\\varnothing", "∅" },
    { "\\forall", "∀" },
    { "\\exists", "∃" },
    { "\\nexists", "∄" },
    { "\\land", "∧" },
    { "\\lor", "∨" },
    { "\\wedge", "∧" },
    { "\\vee", "∨" },
    { "\\neg", "¬" },
    { "\\equiv", "≡" },
    { "\\iff", "⇔" },
    { "\\Leftrightarrow", "⇔" },
    { "\\leftrightarrow", "↔" },
    { "\\Leftarrow", "⇐" },
    { "\\leftarrow", "←" },
    { "\\Rightarrow", "⇒" },
    { "\\rightarrow", "→" },
    { "\\longrightarrow", "⟶" },
    { "\\to", "→" },
    { "\\implies", "⇒" },
    { "\\leq", "≤" },
    { "\\geq", "≥" },
    { "\\le", "≤" },
    { "\\ge", "≥" },
    { "\\neq", "≠" },
    { "\\ne", "≠" },
    { "\\approx", "≈" },
    { "\\cong", "≅" },
    { "\\propto", "∝" },
    { "\\pm", "±" },
    { "\\mp", "∓" },
    { "\\cdot", "·" },
    { "\\times", "×" },
    { "\\div", "÷" },
    { "\\ast", "∗" },
    { "\\star", "⋆" },
    { "\\cup", "∪" },
    { "\\cap", "∩" },
    { "\\sqcup", "⊔" },
    { "\\sqcap", "⊓" },
    { "\\int", "∫" },
    { "\\iint", "∬" },
    { "\\iiint", "∭" },
    { "\\oint", "∮" },
    { "\\sum", "Σ" },
    { "\\prod", "Π" },
    { "\\coprod", "∐" },
    { "\\infty", "∞" },
    { "\\partial", "∂" },
    { "\\nabla", "∇" },
    { "\\mid", "|" },
    { "\\vert", "|" },
    { "\\lvert", "|" },
    { "\\rvert", "|" },
    { "\\colon", ":" },
    { "\\dots", "…" },
    { "\\ldots", "…" },
    { "\\cdots", "⋯" },
    { "\\left", "" },
    { "\\right", "" },
    { "\\middle", "" },
    { "\\{", MATH_LITERAL_LEFT_BRACE },
    { "\\}", MATH_LITERAL_RIGHT_BRACE },
    { "\\lbrace", MATH_LITERAL_LEFT_BRACE },
    { "\\rbrace", MATH_LITERAL_RIGHT_BRACE },
    { "\\,", " " },
    { "\\;", " " },
    { "\\!", "" },
    { "\\quad", " " },
    { "\\qquad", "  " },
    { "\\alpha", "α" },
    { "\\beta", "β" },
    { "\\gamma", "γ" },
    { "\\delta", "δ" },
    { "\\epsilon", "ε" },
    { "\\varepsilon", "ϵ" },
    { "\\zeta", "ζ" },
    { "\\eta", "η" },
    { "\\theta", "θ" },
    { "\\vartheta", "ϑ" },
    { "\\iota", "ι" },
    { "\\kappa", "κ" },
    { "\\lambda", "λ" },
    { "\\mu", "μ" },
    { "\\nu", "ν" },
    { "\\xi", "ξ" },
    { "\\pi", "π" },
    { "\\varpi", "ϖ" },
    { "\\rho", "ρ" },
    { "\\varrho", "ϱ" },
    { "\\sigma", "σ" },
    { "\\varsigma", "ς" },
    { "\\tau", "τ" },
    { "\\upsilon", "υ" },
    { "\\phi", "φ" },
    { "\\varphi", "ϕ" },
    { "\\chi", "χ" },
    { "\\psi", "ψ" },
    { "\\omega", "ω" },
    { "\\Gamma", "Γ" },
    { "\\Delta", "Δ" },
    { "\\Theta", "Θ" },
    { "\\Lambda", "Λ" },
    { "\\Xi", "Ξ" },
    { "\\Pi", "Π" },
    { "\\Sigma", "Σ" },
    { "\\Upsilon", "Υ" },
    { "\\Phi", "Φ" },
    { "\\Psi", "Ψ" },
    { "\\Omega", "Ω" },
    { "\\in", "∈" },
}

local superscripts = {
    ["0"] = "⁰",
    ["1"] = "¹",
    ["2"] = "²",
    ["3"] = "³",
    ["4"] = "⁴",
    ["5"] = "⁵",
    ["6"] = "⁶",
    ["7"] = "⁷",
    ["8"] = "⁸",
    ["9"] = "⁹",
    ["+"] = "⁺",
    ["-"] = "⁻",
    ["="] = "⁼",
    ["("] = "⁽",
    [")"] = "⁾",
    ["a"] = "ᵃ",
    ["b"] = "ᵇ",
    ["c"] = "ᶜ",
    ["d"] = "ᵈ",
    ["e"] = "ᵉ",
    ["f"] = "ᶠ",
    ["g"] = "ᵍ",
    ["h"] = "ʰ",
    ["i"] = "ⁱ",
    ["j"] = "ʲ",
    ["k"] = "ᵏ",
    ["l"] = "ˡ",
    ["m"] = "ᵐ",
    ["n"] = "ⁿ",
    ["o"] = "ᵒ",
    ["p"] = "ᵖ",
    ["r"] = "ʳ",
    ["s"] = "ˢ",
    ["t"] = "ᵗ",
    ["u"] = "ᵘ",
    ["v"] = "ᵛ",
    ["w"] = "ʷ",
    ["x"] = "ˣ",
    ["y"] = "ʸ",
    ["z"] = "ᶻ",
    ["A"] = "ᴬ",
    ["B"] = "ᴮ",
    ["C"] = "ᶜ",
    ["D"] = "ᴰ",
    ["E"] = "ᴱ",
    ["F"] = "ᶠ",
    ["G"] = "ᴳ",
    ["H"] = "ᴴ",
    ["I"] = "ᴵ",
    ["J"] = "ᴶ",
    ["K"] = "ᴷ",
    ["L"] = "ᴸ",
    ["M"] = "ᴹ",
    ["N"] = "ᴺ",
    ["O"] = "ᴼ",
    ["P"] = "ᴾ",
    ["R"] = "ᴿ",
    ["T"] = "ᵀ",
    ["U"] = "ᵁ",
    ["V"] = "ⱽ",
    ["W"] = "ᵂ",
    ["X"] = "ˣ",
    ["Y"] = "ʸ",
    ["Z"] = "ᶻ",
}

local subscripts = {
    ["0"] = "₀",
    ["1"] = "₁",
    ["2"] = "₂",
    ["3"] = "₃",
    ["4"] = "₄",
    ["5"] = "₅",
    ["6"] = "₆",
    ["7"] = "₇",
    ["8"] = "₈",
    ["9"] = "₉",
    ["+"] = "₊",
    ["-"] = "₋",
    ["="] = "₌",
    ["("] = "₍",
    [")"] = "₎",
    ["a"] = "ₐ",
    ["e"] = "ₑ",
    ["h"] = "ₕ",
    ["i"] = "ᵢ",
    ["j"] = "ⱼ",
    ["k"] = "ₖ",
    ["l"] = "ₗ",
    ["m"] = "ₘ",
    ["n"] = "ₙ",
    ["o"] = "ₒ",
    ["p"] = "ₚ",
    ["r"] = "ᵣ",
    ["s"] = "ₛ",
    ["t"] = "ₜ",
    ["u"] = "ᵤ",
    ["v"] = "ᵥ",
    ["x"] = "ₓ",
}

local style_commands = {
    "mathrm",
    "mathbf",
    "mathbb",
    "mathcal",
    "mathfrak",
    "mathit",
    "mathsf",
    "mathtt",
    "operatorname",
    "textbf",
    "textit",
}

local function replaceMathSymbols(value)
    for _, replacement in ipairs(math_replacements) do
        value = value:gsub(replacement[1], replacement[2])
    end
    return value
end

local xarrow_commands = {
    { "\\xLeftrightarrow", "⇔" },
    { "\\xRightarrow", "⇒" },
    { "\\xLeftarrow", "⇐" },
    { "\\xleftrightarrow", "↔" },
    { "\\xleftarrow", "←" },
    { "\\xrightarrow", "⟶" },
    { "\\xhookleftarrow", "↩" },
    { "\\xhookrightarrow", "↪" },
    { "\\xmapsto", "↦" },
}

local function replaceXArrows(value, replacement)
    for _, command in ipairs(xarrow_commands) do
        local pattern = command[1] .. "%s*(%b{})"
        value = value:gsub(pattern, function(label)
            return replacement(label:sub(2, -2), command[2])
        end)
    end
    return value
end

local function normalizeMath(value)
    value = value:gsub("\\frac%s*{([^{}]+)}%s*{([^{}]+)}", "(%1)/(%2)")
    value = value:gsub("\\sqrt%s*{([^{}]+)}", "√(%1)")
    value = value:gsub("\\text%s*{([^{}]+)}", "%1")
    for _, command in ipairs(style_commands) do
        value = value:gsub("\\" .. command .. "%s*{([^{}]+)}", "%1")
    end
    value = replaceMathSymbols(value)
    value = value:gsub("\\([A-Za-z]+)", "%1")
    return value
end

local function formatScriptGroup(group, replacements)
    return group:gsub("([%w%+%-%=()])", function(character)
        return replacements[character] or character
    end)
end

local function formatMath(value)
    value = replaceXArrows(value, function(label, symbol)
        return symbol .. "[" .. label .. "]"
    end)
    value = normalizeMath(value)
    value = value:gsub("%^{([^{}]+)}", function(group)
        return formatScriptGroup(group, superscripts)
    end)
    value = value:gsub("_{([^{}]+)}", function(group)
        return formatScriptGroup(group, subscripts)
    end)
    value = value:gsub("{([^{}]+)}", "%1")
    value = value:gsub("%^([%w%+%-%=()])", function(character)
        return superscripts[character] or character
    end)
    value = value:gsub("_([^%s%p])", function(character)
        return subscripts[character] or "_" .. character
    end)
    value = value:gsub(MATH_LITERAL_LEFT_BRACE, "{")
    value = value:gsub(MATH_LITERAL_RIGHT_BRACE, "}")
    value = value:gsub("|", MATH_BAR_TOKEN)
    value = value:gsub("%s+", " ")
    return trim(value)
end

local function replaceMathDelimiters(value, renderer)
    value = value:gsub("%$%$([%s%S]-)%$%$", function(expression)
        return renderer(expression, true)
    end)
    value = value:gsub("\\%[([%s%S]-)\\%]", function(expression)
        return renderer(expression, true)
    end)
    value = value:gsub("\\%(([%s%S]-)\\%)", function(expression)
        return renderer(expression, false)
    end)
    value = value:gsub("%$([^$\n]+)%$", function(expression)
        return renderer(expression, false)
    end)
    return value
end

local function renderMathDelimiters(value)
    return replaceMathDelimiters(value, function(expression)
        return formatMath(expression)
    end)
end

local function sanitizeMarkdown(markdown)
    local text = markdown:gsub("\r\n", "\n"):gsub("\r", "\n")
    text = text:gsub("<(https?://[^>]+)>", "%1")
    text = text:gsub("<[Ss][Cc][Rr][Ii][Pp][Tt][^>]*>.-</[Ss][Cc][Rr][Ii][Pp][Tt]>", "")
    text = text:gsub("<[Ss][Tt][Yy][Ll][Ee][^>]*>.-</[Ss][Tt][Yy][Ll][Ee]>", "")
    text = text:gsub("<[^>\n]->", "")
    text = text:gsub("(```)[^\n]*", "%1")
    text = text:gsub("!%[([^%]]*)%](%b())", "%1")
    text = text:gsub("!%[([^%]]*)%]%[([^%]]*)%]", "%1")
    text = text:gsub("!%[([^%]]*)%]", "%1")
    text = text:gsub("%[([^%]]+)%](%b())", function(label, destination)
        local url = destination:sub(2, -2)
        if url:match("^https?://") then
            return label .. " (" .. url .. ")"
        end
        return label
    end)
    text = text:gsub("%[([^%]]+)%]%s*%[[^%]]*%]", "%1")
    text = text:gsub("^%s*%[[^%]\n]+%]%s*:%s*[^\n]*\n?", "")
    text = text:gsub("\n%s*%[[^%]\n]+%]%s*:%s*[^\n]*", "\n")
    text = text:gsub("%[([^%]]+)%]", "%1")
    return text
end

local function transformOutsideCode(markdown, transform)
    local output = {}
    local segment = {}
    local in_code_block = false

    local function flushSegment()
        if #segment == 0 then
            return
        end
        output[#output + 1] = transform(table.concat(segment, "\n"))
        segment = {}
    end

    for line in (markdown .. "\n"):gmatch("([^\n]*)\n") do
        if line:match("^%s*```") then
            if in_code_block then
                output[#output + 1] = line
                in_code_block = false
            else
                flushSegment()
                output[#output + 1] = line
                in_code_block = true
            end
        elseif in_code_block then
            output[#output + 1] = line
        else
            segment[#segment + 1] = line
        end
    end
    flushSegment()

    return table.concat(output, "\n")
end

local function transformInline(value)
    value = value:gsub("!%[([^%]]*)%](%b())", "%1")
    value = value:gsub("%[([^%]]+)%](%b())", function(label, destination)
        local url = destination:sub(2, -2)
        if url:match("^https?://") then
            return label .. " (" .. url .. ")"
        end
        return label
    end)
    value = value:gsub("<(https?://[^>]+)>", "%1")
    value = value:gsub("`([^`]+)`", "%1")
    value = value:gsub("%*%*([^*]+)%*%*", "%1")
    value = value:gsub("__([^_]+)__", "%1")
    value = value:gsub("%*([^*]+)%*", "%1")
    value = value:gsub("_([^_]+)_", "%1")
    return value
end

local function nextUtf8Character(value, index)
    local first = value:byte(index)
    if not first then
        return nil, index
    end
    local length = 1
    if first >= 240 then
        length = 4
    elseif first >= 224 then
        length = 3
    elseif first >= 192 then
        length = 2
    end
    return value:sub(index, index + length - 1), index + length
end

local function scriptOperand(value, index)
    if value:sub(index, index) ~= "{" then
        return nextUtf8Character(value, index)
    end

    local depth = 1
    local cursor = index + 1
    while cursor <= #value do
        local character = value:sub(cursor, cursor)
        if character == "{" then
            depth = depth + 1
        elseif character == "}" then
            depth = depth - 1
            if depth == 0 then
                return value:sub(index + 1, cursor - 1), cursor + 1
            end
        end
        cursor = cursor + 1
    end
    return nil, index
end

local function escapeHtml(value)
    value = tostring(value)
    value = value:gsub("&", "&amp;")
    value = value:gsub("<", "&lt;")
    value = value:gsub(">", "&gt;")
    value = value:gsub('"', "&quot;")
    value = value:gsub("'", "&#39;")
    return value
end

local function renderMathText(value, arrows)
    local output = {}
    local index = 1
    while index <= #value do
        local character, next_index = nextUtf8Character(value, index)
        if character == MATH_XARROW_START and arrows then
            local end_index = value:find(MATH_XARROW_END, next_index, true)
            local arrow_index = end_index and tonumber(value:sub(next_index, end_index - 1))
            local arrow = arrow_index and arrows[arrow_index]
            if arrow then
                if trim(arrow.label) == "" then
                    output[#output + 1] = escapeHtml(arrow.symbol)
                else
                    local label = renderMathText(normalizeMath(arrow.label), arrows)
                    output[#output + 1] = '<span style="display: inline-block; text-align: center; vertical-align: middle;">'
                    output[#output + 1] = '<span style="display: block; font-size: 0.65em; line-height: 1;">'
                    output[#output + 1] = label
                    output[#output + 1] = "</span>"
                    output[#output + 1] = '<span style="display: block; line-height: 1;">'
                    output[#output + 1] = escapeHtml(arrow.symbol)
                    output[#output + 1] = "</span></span>"
                end
                index = end_index + 1
            else
                output[#output + 1] = escapeHtml(character)
                index = next_index
            end
        elseif character == "^" or character == "_" then
            local operand, after_operand = scriptOperand(value, next_index)
            if operand then
                local tag = character == "^" and "sup" or "sub"
                output[#output + 1] = "<" .. tag .. ">"
                output[#output + 1] = renderMathText(operand, arrows)
                output[#output + 1] = "</" .. tag .. ">"
                index = after_operand
            else
                output[#output + 1] = escapeHtml(character)
                index = next_index
            end
        elseif character == MATH_LITERAL_LEFT_BRACE then
            output[#output + 1] = "{"
            index = next_index
        elseif character == MATH_LITERAL_RIGHT_BRACE then
            output[#output + 1] = "}"
            index = next_index
        elseif character == "{" or character == "}" then
            output[#output + 1] = escapeHtml(character)
            index = next_index
        elseif #character == 1 and character:match("%a") then
            output[#output + 1] = "<i>" .. escapeHtml(character) .. "</i>"
            index = next_index
        else
            output[#output + 1] = escapeHtml(character)
            index = next_index
        end
    end
    return table.concat(output)
end

local function formatMathHtml(value, is_block)
    local arrows = {}
    value = replaceXArrows(value, function(label, symbol)
        local index = #arrows + 1
        arrows[index] = {
            label = label,
            symbol = symbol,
        }
        return MATH_XARROW_START .. tostring(index) .. MATH_XARROW_END
    end)
    value = normalizeMath(value)
    value = trim(value:gsub("%s+", " "))
    local rendered = renderMathText(value, arrows)
    if is_block then
        return '<div style="text-align: center; margin: 0.6em 0;">' .. rendered .. "</div>"
    end
    return '<span class="karenda-math">' .. rendered .. "</span>"
end

local function mathToken(index)
    return MATH_TOKEN_PREFIX .. tostring(index) .. "End"
end

local function prepareHtmlMarkdown(markdown)
    local slots = {}
    local function renderSegment(segment)
        return replaceMathDelimiters(segment, function(expression, is_block)
            local index = #slots + 1
            slots[index] = {
                block = is_block,
                html = formatMathHtml(expression, is_block),
            }
            return mathToken(index)
        end)
    end

    return transformOutsideCode(markdown, renderSegment), slots
end

local function splitTableRow(line)
    line = line:gsub("^%s*|", "")
    line = line:gsub("|%s*$", "")
    line = line:gsub("\\|", TABLE_PIPE_TOKEN)
    local cells = {}
    for cell in (line .. "|"):gmatch("([^|]*)|") do
        cells[#cells + 1] = trim(cell):gsub(TABLE_PIPE_TOKEN, "|")
    end
    return cells
end

local function tableAlignment(separator)
    local starts_center = separator:sub(1, 1) == ":"
    local ends_center = separator:sub(-1) == ":"
    if starts_center and ends_center then
        return "center"
    elseif starts_center then
        return "left"
    elseif ends_center then
        return "right"
    end
    return nil
end

local function isTableSeparator(cells)
    if #cells == 0 then
        return false
    end
    for _, cell in ipairs(cells) do
        if not cell:match("^:?-+:?$") then
            return false
        end
    end
    return true
end

local function renderTableCell(renderer, cell)
    local rendered = renderer(cell) or ""
    rendered = rendered:gsub("^<p>([%s%S]-)</p>$", "%1")
    return rendered
end

local function renderTable(headers, alignments, rows, renderer)
    local output = {
        '<table style="border-collapse: collapse; width: 100%;">',
        "<thead><tr>",
    }
    for index, header in ipairs(headers) do
        local alignment = alignments[index]
        local style = alignment and ' style="text-align: ' .. alignment .. ';"' or ""
        output[#output + 1] = "<th" .. style .. ">"
        output[#output + 1] = renderTableCell(renderer, header)
        output[#output + 1] = "</th>"
    end
    output[#output + 1] = "</tr></thead><tbody>"
    for _, row in ipairs(rows) do
        output[#output + 1] = "<tr>"
        for index = 1, #headers do
            local alignment = alignments[index]
            local style = alignment and ' style="text-align: ' .. alignment .. ';"' or ""
            output[#output + 1] = "<td" .. style .. ">"
            output[#output + 1] = renderTableCell(renderer, row[index] or "")
            output[#output + 1] = "</td>"
        end
        output[#output + 1] = "</tr>"
    end
    output[#output + 1] = "</tbody></table>"
    return table.concat(output)
end

local function tableToken(index)
    return TABLE_TOKEN_PREFIX .. tostring(index) .. "End"
end

local function prepareHtmlTables(markdown, renderer)
    local lines = {}
    for line in (markdown .. "\n"):gmatch("([^\n]*)\n") do
        lines[#lines + 1] = line
    end

    local output = {}
    local slots = {}
    local in_code_block = false
    local index = 1
    while index <= #lines do
        local line = lines[index]
        if line:match("^%s*```") then
            output[#output + 1] = line
            in_code_block = not in_code_block
            index = index + 1
        elseif not in_code_block and line:find("|", 1, true) and lines[index + 1]
            and lines[index + 1]:find("|", 1, true)
        then
            local headers = splitTableRow(line)
            local separators = splitTableRow(lines[index + 1])
            if #headers > 0 and #headers == #separators and isTableSeparator(separators) then
                local rows = {}
                index = index + 2
                while index <= #lines and lines[index] ~= ""
                    and not lines[index]:match("^%s*```")
                    and lines[index]:find("|", 1, true)
                do
                    rows[#rows + 1] = splitTableRow(lines[index])
                    index = index + 1
                end

                local alignments = {}
                for cell_index, separator in ipairs(separators) do
                    alignments[cell_index] = tableAlignment(separator)
                end
                local slot_index = #slots + 1
                slots[slot_index] = {
                    block = true,
                    html = renderTable(headers, alignments, rows, renderer),
                }
                output[#output + 1] = tableToken(slot_index)
            else
                output[#output + 1] = line
                index = index + 1
            end
        else
            output[#output + 1] = line
            index = index + 1
        end
    end

    return table.concat(output, "\n"), slots
end

local function plainHtmlFallback(markdown)
    local text = Markdown.toPlainText(markdown)
    text = escapeHtml(text):gsub("\n", "<br />")
    return "<p>" .. text .. "</p>"
end

function Markdown.toPlainText(markdown)
    if type(markdown) ~= "string" or markdown == "" then
        return ""
    end

    local text = sanitizeMarkdown(markdown)
    text = transformOutsideCode(text, renderMathDelimiters)

    local lines = {}
    local in_code_block = false
    for line in (text .. "\n"):gmatch("([^\n]*)\n") do
        if line:match("^%s*```") then
            in_code_block = not in_code_block
        elseif in_code_block then
            lines[#lines + 1] = line:gsub(MATH_BAR_TOKEN, "|")
        else
            line = line:gsub("^%s*#+%s*", "")
            line = line:gsub("^%s*>%s?", "- ")
            line = line:gsub("^%s*[%-%*+]%s+", "- ")
            line = transformInline(line)
            line = line:gsub("^%s*|", "")
            line = line:gsub("|%s*$", "")
            line = line:gsub("%s*|%s*", " | ")
            line = line:gsub(MATH_BAR_TOKEN, "|")
            lines[#lines + 1] = trim(line)
        end
    end

    local result = {}
    local blank_count = 0
    for _, line in ipairs(lines) do
        if line == "" then
            blank_count = blank_count + 1
            if blank_count <= 2 then
                result[#result + 1] = ""
            end
        else
            blank_count = 0
            result[#result + 1] = line
        end
    end

    return trim(table.concat(result, "\n"))
end

function Markdown.toHtml(markdown)
    if type(markdown) ~= "string" or markdown == "" then
        return ""
    end

    local loaded, MD = pcall(require, "apps/filemanager/lib/md")
    if not loaded then
        return plainHtmlFallback(markdown)
    end

    local sanitized = sanitizeMarkdown(markdown)
    local prepared, math_slots = prepareHtmlMarkdown(sanitized)
    local table_slots
    prepared, table_slots = prepareHtmlTables(prepared, MD)
    local html = MD(prepared)
    if not html then
        return plainHtmlFallback(markdown)
    end

    for index, slot in ipairs(table_slots) do
        local token = tableToken(index)
        if slot.block then
            html = html:gsub("<p>%s*" .. token .. "%s*</p>", function()
                return slot.html
            end)
        end
        html = html:gsub(token, function()
            return slot.html
        end)
    end

    for index, slot in ipairs(math_slots) do
        local token = mathToken(index)
        if slot.block then
            html = html:gsub("<p>%s*" .. token .. "%s*</p>", function()
                return slot.html
            end)
        end
        html = html:gsub(token, function()
            return slot.html
        end)
    end
    return html
end

Markdown.escapeHtml = escapeHtml

return Markdown
