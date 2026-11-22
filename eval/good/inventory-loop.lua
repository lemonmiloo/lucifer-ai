local bot = getBot()
if bot == nil then return end
local inv = bot:getInventory()
if inv then
  local items = inv:getItems()
  for i = 1, #items do
    local item = items[i]
    if item then print(item.id, item.count) end
  end
end