local bot = getBot()
addEvent(Event.generic_text, function(text)
  sleep(1000)
  while true do print(text) end
end)
listenEvents(5)