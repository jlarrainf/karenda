local DataStorage = require("datastorage")
local DateUtils = require("date_utils")
local util = require("util")

local StatisticsCollector = {}
StatisticsCollector.__index = StatisticsCollector

local DB_PATH = DataStorage:getSettingsDir() .. "/statistics.sqlite3"

local DAILY_SQL = [[
    SELECT dates,
           count(*) AS pages,
           sum(sum_duration) AS durations
    FROM (
        SELECT strftime('%%Y-%%m-%%d', start_time, 'unixepoch', 'localtime') AS dates,
               sum(duration) AS sum_duration
        FROM page_stat
        WHERE start_time >= %d AND start_time < %d
        GROUP BY id_book, page, dates
    )
    GROUP BY dates
    ORDER BY dates ASC;
]]

local COMPLETION_SQL = [[
    SELECT page_stat.id_book, page_stat.page, page_stat.start_time, book.pages
    FROM page_stat
    INNER JOIN book ON book.id = page_stat.id_book
    WHERE book.pages > 0
    ORDER BY page_stat.id_book ASC, page_stat.start_time ASC;
]]

local function dateTimestamp(date_key)
    local parts = DateUtils.parseDateKey(date_key)
    if not parts then return nil end
    return os.time{
        year = parts.year,
        month = parts.month,
        day = parts.day,
        hour = 0,
        min = 0,
        sec = 0,
    }
end

local function inRange(date_key, from_date, to_date)
    return date_key and date_key >= from_date and date_key <= to_date
end

local function addReadingRow(stats, date_key, pages, duration)
    if type(date_key) ~= "string" then return end
    local row = stats[date_key] or { pages = 0, minutes = 0, books = 0 }
    row.pages = row.pages + (tonumber(pages) or 0)
    row.minutes = row.minutes + ((tonumber(duration) or 0) / 60)
    stats[date_key] = row
end

function StatisticsCollector:new(options)
    options = options or {}
    return setmetatable({
        dbPath = options.dbPath or DB_PATH,
        fileExists = options.fileExists or util.fileExists,
        open = options.open,
    }, self)
end

function StatisticsCollector:openDatabase()
    if not self.fileExists(self.dbPath) then
        return nil, {
            code = "STATISTICS_UNAVAILABLE",
            message = "Las estadísticas de lectura de KOReader no están disponibles.",
        }
    end

    local opener = self.open
    if not opener then
        local SQ3 = require("lua-ljsqlite3/init")
        opener = function(path) return SQ3.open(path) end
    end

    local ok, connection = pcall(opener, self.dbPath)
    if not ok or not connection then
        return nil, {
            code = "STATISTICS_UNAVAILABLE",
            message = "No se pudo leer la base de estadísticas de KOReader.",
        }
    end
    return connection
end

function StatisticsCollector:getDailyStats(from_date, to_date)
    if not DateUtils.isDateKey(from_date) or not DateUtils.isDateKey(to_date) or from_date > to_date then
        return nil, {
            code = "INVALID_REQUEST",
            message = "El periodo de estadísticas no es válido.",
        }
    end

    local connection, open_error = self:openDatabase()
    if not connection then return nil, open_error end

    local from_timestamp = dateTimestamp(from_date)
    local after_to_timestamp = dateTimestamp(DateUtils.addDays(to_date, 1))
    local ok, result, completion_rows = pcall(function()
        local daily = connection:exec(string.format(DAILY_SQL, from_timestamp, after_to_timestamp)) or {}
        local completed = connection:exec(COMPLETION_SQL) or {}
        return daily, completed
    end)
    pcall(connection.close, connection)
    if not ok then
        return nil, {
            code = "STATISTICS_UNAVAILABLE",
            message = "No se pudo leer la base de estadísticas de KOReader.",
        }
    end

    local stats = {}
    if result and result.dates then
        for index, date_key in ipairs(result.dates) do
            addReadingRow(stats, date_key, result.pages[index], result.durations[index])
        end
    end

    local seen_pages = {}
    local completed_books = {}
    if completion_rows and completion_rows.id_book then
        for index, book_id in ipairs(completion_rows.id_book) do
            local id = tonumber(book_id)
            local page = tonumber(completion_rows.page[index])
            local total_pages = tonumber(completion_rows.pages[index])
            if id and page and total_pages and total_pages > 0 and not completed_books[id] then
                local pages = seen_pages[id] or {}
                if not pages[page] then pages[page] = true end
                seen_pages[id] = pages
                local read_pages = 0
                for _ in pairs(pages) do read_pages = read_pages + 1 end
                if read_pages >= total_pages then
                    local timestamp = tonumber(completion_rows.start_time[index])
                    local completion_date = timestamp and os.date("%Y-%m-%d", timestamp)
                    if inRange(completion_date, from_date, to_date) then
                        local row = stats[completion_date] or { pages = 0, minutes = 0, books = 0 }
                        row.books = row.books + 1
                        stats[completion_date] = row
                    end
                    completed_books[id] = true
                end
            end
        end
    end

    return stats
end

return StatisticsCollector
