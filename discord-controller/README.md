# Lucifer Discord Controller

Discord-first control panel for live bot telemetry and allowlisted world navigation.

This is a standalone Node.js service. It does not modify the existing AI web app. The Discord message is the UI: one live embed with buttons, and the WORLD button opens a native Discord modal.

## Safety boundary

- This project reports generic bot status and supports navigation only to worlds explicitly listed in an allowlist.
- Do not add worlds unless you own them or are explicitly authorized to access them.
- It does not implement wordlists, brute-force attempts, ID guessing, credential testing, or hit collection.
- Keep the bridge API bound to localhost unless you deliberately configure a protected private network.

## Requirements

- Node.js 20+
- A Discord application and bot
- The bot invited to your server with bot + applications.commands scopes and permission to send messages, embed links, and use application commands.

## Setup on the same Windows RDP as Lucifer

1. Copy this folder to the RDP.
2. Open a terminal in `discord-controller`.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Fill in:
   - `DISCORD_TOKEN`: bot token from Discord Developer Portal
   - `DISCORD_CLIENT_ID`: application ID
   - `DISCORD_GUILD_ID`: server ID where the panel should appear
   - `DISCORD_ADMIN_IDS`: comma-separated Discord user IDs allowed to use buttons
   - `BRIDGE_TOKEN`: long random secret
   - `ALLOWED_WORLDS`: comma-separated world names you own or may access
6. In `lua/bridge.lua`, set the same bridge token and same world allowlist.
7. Run `npm start`.
8. In the Discord server, run `/lucifer-panel`.

The API listens on `127.0.0.1:8787` by default. Keep it on localhost when the Lua runtime and Discord service run on the same RDP.

## Lua integration

The bridge uses the same `HttpClient.new()`, `Method.get`, and `Method.post` style as the supplied Lua environment.

Load `lua/bridge.lua` in the Lucifer runtime and call this from a safe, existing main loop:

```lua
while true do
    local bot = getBot()
    lucifer_bridge_tick(bot)
    -- Keep your own permitted, non-scanning application logic here.
    sleep(250)
end
```

Do not run a second infinite loop if the existing script already owns the main loop. In that case, call `lucifer_bridge_tick(getBot())` from the existing loop instead.

The Lua and Node.js allowlists must match exactly. The Node.js service validates the modal input, and the Lua bridge validates it again before calling `bot:warp(world)`.

## Discord panel

- `/lucifer-panel`: creates the single panel message.
- `WORLD`: opens a native Discord modal; submission queues navigation only if the world is allowlisted.
- `REFRESH`: redraws the current live status.
- `INFO`: shows a private status summary.

The panel message is edited in place as telemetry arrives. It is not reposted every few seconds.

## Security

- Never commit `.env` or share bot tokens.
- Use a unique random `BRIDGE_TOKEN`.
- Set `DISCORD_ADMIN_IDS`; without an admin ID, all panel controls are denied.
- Do not expose port 8787 to the public internet.
- If a token is exposed, rotate it immediately in the relevant service.
