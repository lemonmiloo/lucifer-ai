local bot = getBot()
local items = bot:getInventory():getItems()
for i = 0, #items - 1 do print(items[i]) end