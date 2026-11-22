local bot = getBot()
local inventory = bot:getInventory()
if not inventory then print("missing") end
print(inventory.itemcount)
