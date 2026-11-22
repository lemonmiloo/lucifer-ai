local bot = getBot()
if bot == nil or not bot:isInWorld() then return end
local world = bot:getWorld()
if not world then return end
for _, tile in ipairs(world:getTilesSafe()) do
  if tile and tile:canHarvest() then bot:hit(tile.x, tile.y) end
end