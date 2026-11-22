local bot = getBot()
if bot and bot.status == BotStatus.online then
  print(bot.name)
end
