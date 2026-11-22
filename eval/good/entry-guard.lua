local bot = getBot()
if bot == nil or not bot:isInWorld() then return end
print(bot.name)