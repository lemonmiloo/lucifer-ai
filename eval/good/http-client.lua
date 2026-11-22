local client = HttpClient.new()
client.url = "https://example.invalid/status"
client:setMethod(Method.get)
local result = client:request()
if result and result.error == 0 then print(result.status) end
