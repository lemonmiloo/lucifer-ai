local bot = getBot()
if bot == nil then return end
bot:warp("FARMWORLD")
listenEvents(5)
local world = bot:getWorld()
if world and bot:isInWorld("FARMWORLD") then
  local tile = world:getTile(20, 24)
  if tile and tile:canHarvest() then bot:hit(20, 24) end
end