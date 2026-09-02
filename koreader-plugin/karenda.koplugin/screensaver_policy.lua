local ScreensaverPolicy = {}

function ScreensaverPolicy.resolve(context, enabled, has_document, book_available)
    if not enabled then
        return "delegate"
    end

    local kind = context and context.kind or "none"

    if kind == "calendar" or kind == "note" then
        return "as_is"
    end

    if has_document and book_available then
        return "book"
    end

    return "delegate"
end

return ScreensaverPolicy
