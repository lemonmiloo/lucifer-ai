export const FEWSHOT = `
P0 ENTRY GUARD
local bot = getBot()
if bot == nil or not bot:isInWorld() then return end

P1 ACTION + STATE CHECK
bot:hit(tx, ty)
listenEvents(2)
local world = bot:getWorld()
local tile = world and world:getTile(tx, ty)
if tile and tile.fg == 0 then bot:collect(3) end

P2 WARP + FRESH SNAPSHOT
bot:warp("FARMWORLD")
listenEvents(5)
local world = bot:getWorld()
if world and bot:isInWorld("FARMWORLD") then
  local tile = world:getTile(20, 24)
  if tile and tile:canHarvest() then bot:hit(20, 24) end
end

P3 EVENT REGISTER -> LISTEN -> CLEANUP
local flagged = false
addEvent(Event.generic_text, function(text)
  if text and text:find("ready") then flagged = true end
end)
listenEvents(8)
if flagged then bot:say("/ok") end
removeEvent(Event.generic_text)

P4 INVENTORY NIL GUARD + 1-BASED
local inv = bot:getInventory()
if inv then
  local items = inv:getItems()
  for i = 1, #items do
    local item = items[i]
    if item then print(item.id .. " x" .. item.count) end
  end
end

FULL EXAMPLE: HARVEST READY TREES
local bot = getBot()
if bot == nil or not bot:isInWorld() then return end
local function harvestReady()
  local world = bot:getWorld()
  if not world then return 0 end
  local count = 0
  for _, tile in ipairs(world:getTilesSafe()) do
    if tile and tile:canHarvest() then
      bot:hit(tile.x, tile.y)
      count = count + 1
    end
  end
  return count
end
bot:warp("FARMWORLD")
listenEvents(5)
local harvested = 0
if bot:isInWorld("FARMWORLD") then
  harvested = harvestReady()
  listenEvents(2)
  bot:collect(3)
end
print("harvested=" .. harvested)

BAD -> GOOD
BAD:
local world = bot:getWorld()
bot:warp("X")
local tile = world:getTile(1, 1)
if bot:hit(1, 1) then end
for i = 0, #world:getTiles() do end

GOOD:
bot:warp("X")
listenEvents(5)
local world = bot:getWorld()
local tile = world and world:getTile(1, 1)
if tile then bot:hit(1, 1); listenEvents(2) end
local tiles = world and world:getTilesSafe() or {}
for i = 1, #tiles do end
`;