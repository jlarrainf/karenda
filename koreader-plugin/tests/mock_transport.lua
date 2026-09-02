local MockTransport = {}
MockTransport.__index = MockTransport

function MockTransport:new(response)
    return setmetatable({
        response = response,
        requests = {},
    }, self)
end

function MockTransport:request(request, callback)
    table.insert(self.requests, request)
    callback(self.response)
end

function MockTransport:setResponse(response)
    self.response = response
end

return MockTransport
