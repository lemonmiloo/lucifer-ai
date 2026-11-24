-- Lucifer Discord Bridge
-- Monitoring + navigation only. This file does not scan, guess, or test world IDs.
-- Add lucifer_bridge_tick(getBot()) inside the existing main loop.

local LUCIFER_API_URL = "http://127.0.0.1:8787"
local LUCIFER_BRIDGE_TOKEN = "CHANGE_ME_TO_THE_SAME_BRIDGE_TOKEN"
local LUCIFER_BOT_ID = "lucifer-main"
local LUCIFER_ALLOWED_WORLDS = {
    MYOWNWORLD = true,
    MYSECONDOWNWORLD = true
}

local bridge_last_status = 0
local bridge_last_poll = 0
local bridge_last_action = "Bridge initialized"

local function bridge_trim(value)
    return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function bridge_json_escape(value)
    value = tostring(value or "")
    value = value:gsub("\\", "\\\\")
    value = value:gsub('"', '\\"')
    value = value:gsub("\n", "\\n")
    value = value:gsub("\r", "")
    return value
end

local function bridge_request(method, url, body)
    local client = HttpClient.new()
    client.url = url
    client:setMethod(method)
    client.headers["Authorization"] = "Bearer " .. LUCIFER_BRIDGE_TOKEN
    client.headers["Content-Type"] = "application/json"
    client.timeout = 8
    if body then client.content = body end
    return client:request()
end

local function bridge_get_world(bot)
    local ok, world = pcall(function()
        local info = bot:getWorld()
        if info and info.name then return info.name end
        return ""
    end)
    if ok then return bridge_trim(world):upper() end
    return ""
end

local function bridge_send_status(bot, now)
    local world = bridge_get_world(bot)
    local online = bot ~= nil
    local name = (bot and bot.name) or "Unknown"
    local x = (bot and bot.x) or 0
    local y = (bot and bot.y) or 0

    local body = string.format(
        '{"online":%s,"botName":"%s","world":"%s","x":%s,"y":%s,"lastAction":"%s"}',
        online and "true" or "false",
        bridge_json_escape(name),
        bridge_json_escape(world ~= "" and world or "-"),
        tostring(x),
        tostring(y),
        bridge_json_escape(bridge_last_action)
    )

    local ok, response = pcall(function()
        return bridge_request(Method.post, LUCIFER_API_URL .. "/api/status", body)
    end)

    if ok and response and response.error == 0 and response.status == 200 then
        bridge_last_status = now
    end
end

local function bridge_ack(command_id)
    local body = '{"id":"' .. bridge_json_escape(command_id) .. '"}'
    pcall(function()
        bridge_request(Method.post, LUCIFER_API_URL .. "/api/commands/ack", body)
    end)
end

local function bridge_poll(bot, now)
    local ok, response = pcall(function()
        return bridge_request(
            Method.get,
            LUCIFER_API_URL .. "/api/commands/poll?botId=" .. LUCIFER_BOT_ID,
            nil
        )
    end)

    if not ok or not response or response.error ~= 0 or response.status ~= 200 then
        return
    end

    local body = bridge_trim(response.body)
    if body == "" then return end

    local command_id, command_type, payload = body:match("^([^|]+)|([^|]+)|([^|]+)$")
    if not command_id or command_type ~= "navigate" then return end

    local world = bridge_trim(payload):upper()
    if not LUCIFER_ALLOWED_WORLDS[world] then
        bridge_last_action = "Rejected non-allowlisted world"
        bridge_ack(command_id)
        return
    end

    if not bot then
        bridge_last_action = "Navigation rejected: bot unavailable"
        bridge_ack(command_id)
        return
    end

    local success = pcall(function()
        bot:warp(world)
    end)

    bridge_last_action = success and ("Navigation requested: " .. world) or "Navigation request failed"
    bridge_ack(command_id)
end

function lucifer_bridge_tick(bot)
    local now = os.time()

    if now - bridge_last_poll >= 2 then
        bridge_poll(bot, now)
        bridge_last_poll = now
    end

    if now - bridge_last_status >= 5 then
        bridge_send_status(bot, now)
    end
end
