local Blitbuffer = require("ffi/blitbuffer")
local Device = require("device")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local CenterContainer = require("ui/widget/container/centercontainer")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local ImageWidget = require("ui/widget/imagewidget")
local OverlapGroup = require("ui/widget/overlapgroup")
local ProgressWidget = require("ui/widget/progresswidget")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextWidget = require("ui/widget/textwidget")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local logger = require("logger")
local ScreensaverConfig = require("screensaver_config")

local Screen = Device.screen
local BookScreensaver = {}

local function isExcluded(ui)
    if not ui.doc_settings or type(ui.doc_settings.isTrue) ~= "function" then
        return false
    end

    local ok, excluded = pcall(ui.doc_settings.isTrue, ui.doc_settings, "exclude_screensaver")
    return ok and excluded == true
end

local function safeString(value, fallback)
    if value == nil then
        return fallback or ""
    end

    local result = tostring(value)
    if result == "" then
        return fallback or ""
    end
    return result
end

local function safeMethod(object, method_name, ...)
    if not object or type(object[method_name]) ~= "function" then
        return nil
    end

    local ok, value = pcall(object[method_name], object, ...)
    if ok then
        return value
    end
    return nil
end

local function clampPage(page, total_pages)
    page = tonumber(page) or 1
    total_pages = math.max(tonumber(total_pages) or 1, 1)
    return math.max(1, math.min(math.floor(page), total_pages))
end

local function formatDuration(seconds)
    seconds = tonumber(seconds)
    if not seconds or seconds <= 0 then
        return "—"
    end

    seconds = math.floor(seconds)
    local hours = math.floor(seconds / 3600)
    local minutes = math.floor((seconds % 3600) / 60)
    if hours > 0 then
        return string.format("%d h %02d min", hours, minutes)
    end
    if minutes > 0 then
        return string.format("%d min", minutes)
    end
    return "< 1 min"
end

local function normalizePages(value)
    value = tonumber(value)
    if not value or value ~= value then
        return nil
    end
    return math.max(0, math.floor(value))
end

local function getAveragePageTime(statistics, status)
    local average = statistics and tonumber(statistics.avg_time)
    if average and average > 0 and average == average then
        return average
    end

    local total_time = tonumber(status and status.time)
    local pages_read = tonumber(status and status.pages)
    if total_time and pages_read and total_time > 0 and pages_read > 0 then
        return total_time / pages_read
    end
    return nil
end

local function formatAveragePageTime(seconds)
    if not seconds or seconds <= 0 then
        return nil
    end
    return formatDuration(seconds) .. "/pág"
end

local function estimateTimeRemaining(statistics, status, pages_left)
    if pages_left == nil then
        return nil
    end
    if pages_left <= 0 then
        return "Terminado"
    end

    local average = getAveragePageTime(statistics, status)
    if average then
        return formatDuration(pages_left * average)
    end

    local native_estimate = safeMethod(statistics, "getTimeForPages", pages_left)
    if native_estimate ~= nil then
        return safeString(native_estimate)
    end
    return nil
end

local function getBookData(ui)
    local props = ui.doc_props or {}
    local total_pages = safeMethod(ui.document, "getPageCount") or 1
    local current_page = safeMethod(ui, "getCurrentPage") or 1
    total_pages = math.max(tonumber(total_pages) or 1, 1)
    current_page = clampPage(current_page, total_pages)

    local book_status = safeMethod(ui.statistics, "getStatsBookStatus") or {}
    local book_pages_left = normalizePages(
        safeMethod(ui.document, "getTotalPagesLeft", current_page)
    )
    if book_pages_left == nil then
        book_pages_left = math.max(0, total_pages - current_page)
    end

    local chapter = ""
    local chapter_pages_left
    local chapter_page_count
    local chapter_pages_done
    if ui.toc then
        chapter = safeMethod(ui.toc, "getTocTitleByPage", current_page)
            or safeMethod(ui.toc, "getTocTitleOfCurrentPage")
            or ""
        chapter_pages_left = normalizePages(
            safeMethod(ui.toc, "getChapterPagesLeft", current_page, true)
        )
        chapter_page_count = normalizePages(
            safeMethod(ui.toc, "getChapterPageCount", current_page)
        )
        chapter_pages_done = normalizePages(
            safeMethod(ui.toc, "getChapterPagesDone", current_page)
        )
        if chapter_pages_left == nil and chapter_page_count and chapter_pages_done then
            chapter_pages_left = math.max(0, chapter_page_count - chapter_pages_done - 1)
        end
        if chapter_pages_left == nil and (chapter ~= "" or chapter_page_count) then
            -- The native footer uses the book remainder for the final chapter.
            chapter_pages_left = book_pages_left
        end
    end

    local cover = safeMethod(ui.bookinfo, "getCoverImage", ui.document)
    local progress = current_page / total_pages
    local average_page_time = getAveragePageTime(ui.statistics, book_status)
    local chapter_progress
    if chapter_page_count and chapter_page_count > 0 then
        local chapter_current_page
        if chapter_pages_done then
            chapter_current_page = chapter_pages_done + 1
        elseif chapter_pages_left then
            chapter_current_page = chapter_page_count - chapter_pages_left
        end
        if chapter_current_page then
            chapter_progress = math.max(0, math.min(
                chapter_current_page / chapter_page_count,
                1
            ))
        end
    end

    local pages_read = normalizePages(book_status.pages)

    return {
        title = safeString(props.display_title or props.title, "Libro sin título"),
        author = safeString(props.authors),
        chapter = safeString(chapter),
        current_page = current_page,
        total_pages = total_pages,
        progress = math.max(0, math.min(progress, 1)),
        chapter_progress = chapter_progress,
        pages_left_chapter = chapter_pages_left,
        pages_left_book = book_pages_left,
        days = safeString(book_status.days, "—"),
        time = formatDuration(book_status.time),
        time_left_chapter = estimateTimeRemaining(ui.statistics, book_status, chapter_pages_left),
        time_left_book = estimateTimeRemaining(ui.statistics, book_status, book_pages_left),
        pages_read = pages_read,
        average_speed = formatAveragePageTime(average_page_time),
        cover = cover,
    }
end

local function makeText(text, face, width, bold, color)
    return TextBoxWidget:new{
        text = text,
        face = face,
        width = width,
        alignment = "center",
        bold = bold,
        fgcolor = color,
    }
end

local function makeStatCard(label, value, width, label_face, value_face, padding, border, background)
    local inner_width = math.max(width - 2 * (padding + border), Screen:scaleBySize(36))
    local content = VerticalGroup:new{
        align = "center",
        makeText(label, label_face, inner_width, false, Blitbuffer.COLOR_BLACK),
        VerticalSpan:new{ width = Screen:scaleBySize(3) },
        makeText(value, value_face, inner_width, true, Blitbuffer.COLOR_BLACK),
    }

    return FrameContainer:new{
        background = background,
        bordersize = border,
        color = Blitbuffer.COLOR_BLACK,
        padding = padding,
        content,
    }
end

local function buildCoverWidget(cover, width, height)
    if not cover then
        return FrameContainer:new{
            width = width,
            height = height,
            background = Blitbuffer.COLOR_WHITE,
            bordersize = 0,
            padding = 0,
            TextWidget:new{
                text = "",
                face = Font:getFace("smallffont"),
            },
        }
    end

    local image = ImageWidget:new{
        image = cover,
        width = width,
        height = height,
        alpha = true,
        image_disposable = true,
        scale_factor = ScreensaverConfig.getValue("cover_fit") == "fit" and 0 or nil,
    }

    return FrameContainer:new{
        width = width,
        height = height,
        bordersize = 0,
        padding = 0,
        background = Blitbuffer.COLOR_WHITE,
        image,
    }
end

local function buildStats(data, panel_width, visibility, label_face, value_face,
        padding, border, background, layout)
    local values = {}

    local function addValue(label, value)
        if value ~= nil and value ~= "" then
            table.insert(values, { label = label, value = tostring(value) })
        end
    end

    if visibility.show_progress then
        addValue("Progreso", string.format("%d %%", math.floor(data.progress * 100 + 0.5)))
    end
    if visibility.show_chapter_progress and data.chapter_progress then
        addValue("Progreso del capítulo", string.format(
            "%d %%",
            math.floor(data.chapter_progress * 100 + 0.5)
        ))
    end
    if visibility.show_page then
        addValue("Página", string.format("%d/%d", data.current_page, data.total_pages))
    end
    if visibility.show_pages_left_chapter and data.pages_left_chapter ~= nil then
        addValue("Páginas del capítulo", string.format("%d restantes", data.pages_left_chapter))
    end
    if visibility.show_pages_left_book and data.pages_left_book ~= nil then
        addValue("Páginas del libro", string.format("%d restantes", data.pages_left_book))
    end
    if visibility.show_time_left_chapter then
        addValue("Tiempo del capítulo", data.time_left_chapter)
    end
    if visibility.show_time_left_book then
        addValue("Tiempo del libro", data.time_left_book)
    end
    if visibility.show_time then
        addValue("Tiempo leído", data.time)
    end
    if visibility.show_days then
        addValue("Días de lectura", data.days)
    end
    if visibility.show_pages_read then
        addValue("Páginas leídas", data.pages_read)
    end
    if visibility.show_average_speed then
        addValue("Ritmo medio", data.average_speed)
    end

    if #values == 0 then
        return nil
    end

    local gap = Screen:scaleBySize(5)
    local columns = layout == "grid" and 2 or #values
    local card_width = math.floor((panel_width - gap * (columns - 1)) / columns)
    local rows = {}
    local row = nil
    for index, item in ipairs(values) do
        if (index - 1) % columns == 0 then
            row = HorizontalGroup:new{ align = "top" }
            table.insert(rows, row)
        end

        table.insert(row, makeStatCard(
            item.label,
            item.value,
            card_width,
            label_face,
            value_face,
            padding,
            border,
            background
        ))
        if index % columns ~= 0 and index < #values then
            table.insert(row, HorizontalSpan:new{ width = gap })
        end
        if index % columns == 0 and index < #values then
            table.insert(rows, VerticalSpan:new{ width = gap })
        end
    end

    local rows_group = VerticalGroup:new{ align = "center" }
    for _, row_item in ipairs(rows) do
        table.insert(rows_group, row_item)
    end

    return CenterContainer:new{
        dimen = Geom:new{ w = panel_width, h = rows_group:getSize().h },
        rows_group,
    }
end

local function calculateOffset(content_size, screen_size, vertical_position, horizontal_alignment)
    local margin = Screen:scaleBySize(16)
    local x
    local y

    if horizontal_alignment == "left" then
        x = margin
    elseif horizontal_alignment == "right" then
        x = math.max(0, screen_size.w - content_size.w - margin)
    else
        x = math.floor((screen_size.w - content_size.w) / 2)
    end

    if vertical_position == "top" then
        y = margin
    elseif vertical_position == "center" then
        y = math.floor((screen_size.h - content_size.h) / 2)
    else
        y = math.max(0, screen_size.h - content_size.h - margin)
    end

    return math.max(0, x), math.max(0, y)
end

local function buildPreviewHint(screen_size)
    local width = math.floor(screen_size.w * 0.68)
    local padding = Screen:scaleBySize(6)
    local border = Screen:scaleBySize(1)
    local hint_content = makeText(
        "Vista previa · toca o pulsa una tecla para salir",
        Font:getFace("smallffont"),
        width - 2 * (padding + border),
        false,
        Blitbuffer.COLOR_BLACK
    )
    local hint = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = border,
        color = Blitbuffer.COLOR_BLACK,
        padding = padding,
        hint_content,
    }
    hint.overlap_offset = {
        Screen:scaleBySize(12),
        Screen:scaleBySize(12),
    }
    return hint
end

local function buildBookWidget(data, options)
    options = options or {}
    local screen_size = Screen:getSize()
    local border = Screen:scaleBySize(1)
    local padding = Screen:scaleBySize(10)
    local panel_width = math.floor(screen_size.w * 0.86)
    local panel_inner_width = panel_width - 2 * (padding + border)

    local title_face = Font:getFace("largeffont")
    local author_face = Font:getFace("smallffont")
    local label_face = Font:getFace("smallffont")
    local value_face = Font:getFace("ffont")
    local card_background = Blitbuffer.COLOR_GRAY_E or Blitbuffer.COLOR_WHITE
    local title_content = VerticalGroup:new{ align = "left" }
    local visibility = {
        show_title = ScreensaverConfig.getBoolean("show_title"),
        show_author = ScreensaverConfig.getBoolean("show_author"),
        show_chapter = ScreensaverConfig.getBoolean("show_chapter"),
        show_progress = ScreensaverConfig.getBoolean("show_progress"),
        show_chapter_progress = ScreensaverConfig.getBoolean("show_chapter_progress"),
        show_page = ScreensaverConfig.getBoolean("show_page"),
        show_pages_left_chapter = ScreensaverConfig.getBoolean("show_pages_left_chapter"),
        show_pages_left_book = ScreensaverConfig.getBoolean("show_pages_left_book"),
        show_time = ScreensaverConfig.getBoolean("show_time"),
        show_time_left_chapter = ScreensaverConfig.getBoolean("show_time_left_chapter"),
        show_time_left_book = ScreensaverConfig.getBoolean("show_time_left_book"),
        show_days = ScreensaverConfig.getBoolean("show_days"),
        show_pages_read = ScreensaverConfig.getBoolean("show_pages_read"),
        show_average_speed = ScreensaverConfig.getBoolean("show_average_speed"),
    }

    if visibility.show_title then
        table.insert(title_content, makeText(data.title, title_face, panel_inner_width, true, Blitbuffer.COLOR_BLACK))
    end
    if visibility.show_author and data.author ~= "" then
        table.insert(title_content, VerticalSpan:new{ width = Screen:scaleBySize(2) })
        table.insert(title_content, makeText(data.author, author_face, panel_inner_width, false, Blitbuffer.COLOR_BLACK))
    end
    if visibility.show_chapter and data.chapter ~= "" then
        table.insert(title_content, VerticalSpan:new{ width = Screen:scaleBySize(4) })
        table.insert(title_content, makeText(data.chapter, author_face, panel_inner_width, false, Blitbuffer.COLOR_BLACK))
    end
    if visibility.show_progress then
        local progress_bar = ProgressWidget:new{
            width = math.floor(panel_inner_width * 0.78),
            height = Screen:scaleBySize(8),
            percentage = data.progress,
            ticks = nil,
            last = nil,
        }
        table.insert(title_content, VerticalSpan:new{ width = Screen:scaleBySize(8) })
        table.insert(title_content, CenterContainer:new{
            dimen = Geom:new{ w = panel_inner_width, h = progress_bar:getSize().h },
            progress_bar,
        })
    end

    local title_card
    if #title_content > 0 then
        title_card = FrameContainer:new{
            background = Blitbuffer.COLOR_WHITE,
            bordersize = border,
            color = Blitbuffer.COLOR_BLACK,
            padding = padding,
            title_content,
        }
    end

    local stats = buildStats(
        data,
        panel_width,
        visibility,
        label_face,
        value_face,
        padding,
        border,
        card_background,
        ScreensaverConfig.getValue("stats_layout")
    )

    local content = VerticalGroup:new{ align = "left" }
    if title_card then
        table.insert(content, title_card)
    end
    if title_card and stats then
        table.insert(content, VerticalSpan:new{ width = Screen:scaleBySize(7) })
    end
    if stats then
        table.insert(content, stats)
    end

    local children = {
        buildCoverWidget(data.cover, screen_size.w, screen_size.h),
    }
    if #content > 0 then
        local content_size = content:getSize()
        local x, y = calculateOffset(
            content_size,
            screen_size,
            ScreensaverConfig.getValue("vertical_position"),
            ScreensaverConfig.getValue("horizontal_alignment")
        )
        content.overlap_offset = { x, y }
        table.insert(children, content)
    end
    if options.preview then
        table.insert(children, buildPreviewHint(screen_size))
    end

    children.dimen = screen_size
    return OverlapGroup:new(children)
end

function BookScreensaver.canShow(ui)
    if not ui or not ui.document or isExcluded(ui) then
        return false
    end

    return ui.bookinfo ~= nil
        and ui.doc_props ~= nil
        and ui.doc_settings ~= nil
end

function BookScreensaver.collectData(ui)
    if not BookScreensaver.canShow(ui) then
        return nil
    end

    local ok, data = pcall(getBookData, ui)
    if not ok then
        logger.warn("Karenda: no se pudo construir la portada con estadísticas; se usará el salvapantallas anterior.")
        return nil
    end
    return data
end

function BookScreensaver.build(ui, options)
    local data = BookScreensaver.collectData(ui)
    if not data then
        return nil
    end

    local ok, widget = pcall(buildBookWidget, data, options)
    if not ok then
        logger.warn("Karenda: no se pudo construir la portada con estadísticas; se usará el salvapantallas anterior.")
        return nil
    end

    return widget
end

return BookScreensaver
