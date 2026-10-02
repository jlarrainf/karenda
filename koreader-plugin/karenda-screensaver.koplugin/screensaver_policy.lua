local ScreensaverPolicy = {}

function ScreensaverPolicy.resolve(context, enabled, book_available, context_policy, no_book_policy)
    if not enabled then
        return "delegate"
    end

    -- Keep the old call shape usable for downstream local tests and forks.
    if type(context_policy) == "boolean" then
        book_available = book_available == true and context_policy == true
        context_policy = "preserve"
    end

    context_policy = context_policy or "preserve"
    no_book_policy = no_book_policy or "delegate"

    local kind = context and context.kind or "none"

    if kind == "calendar" or kind == "note" then
        if context_policy == "preserve" then
            return "as_is"
        end
    end

    if book_available then
        return "book"
    end

    if no_book_policy == "as_is" then
        return "as_is"
    end

    return "delegate"
end

return ScreensaverPolicy
