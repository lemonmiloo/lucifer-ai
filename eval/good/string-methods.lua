local bot = getBot()
if bot == nil then return end
local ready = false
addEvent(Event.generic_text, function(text)
  if text and text:find("ready") then ready = true end
end)
listenEvents(2)
removeEvent(Event.generic_text)
if ready then print(string.lower("READY")) end
