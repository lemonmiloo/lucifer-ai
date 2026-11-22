local bot = getBot()
if bot == nil then return end
local world = bot:getWorld()
bot:warp("FARMWORLD")
listenEvents(5)
world = bot:getWorld()
if world then
  local tile = world:getTile(1, 1)
  if tile then print(tile.fg) end
end
