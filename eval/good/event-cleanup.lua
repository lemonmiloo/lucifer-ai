local bot = getBot()
if bot == nil then return end
local ready = false
addEvent(Event.generic_text, function(text)
  if text and text:find("ready") then ready = true end
end)
listenEvents(5)
if ready then bot:say("/ok") end
removeEvent(Event.generic_text)