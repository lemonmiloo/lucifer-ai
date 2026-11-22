local bot = getBot()
listenEvents(2)
addEvent(Event.generic_text, function(text) print(text) end)
removeEvents()
