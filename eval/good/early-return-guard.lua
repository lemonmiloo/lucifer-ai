local bot = getBot()
if bot == nil then return end
local inventory = bot:getInventory()
if not inventory then return end
print(inventory.itemcount)
