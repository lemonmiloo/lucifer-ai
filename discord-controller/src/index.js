import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

const required = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID", "BRIDGE_TOKEN"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;
const BOT_ID = process.env.BOT_ID || "lucifer-main";
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const ADMIN_IDS = new Set((process.env.DISCORD_ADMIN_IDS || "").split(",").map(v => v.trim()).filter(Boolean));
const ALLOWED_WORLDS = new Set((process.env.ALLOWED_WORLDS || "").split(",").map(v => v.trim().toUpperCase()).filter(Boolean));

if (ALLOWED_WORLDS.size === 0) {
  throw new Error("ALLOWED_WORLDS is empty. Add worlds you own or are explicitly authorized to access.");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();
app.use(express.json({ limit: "16kb" }));

const state = {
  online: false,
  botName: "Waiting for Lua bridge",
  world: "-",
  x: null,
  y: null,
  lastAction: "Waiting for first heartbeat",
  updatedAt: null
};
let pendingCommand = null;
let panelRef = null;
const activityLog = [];
let lastHeartbeatOnline = false;

function addActivity(message) {
  const time = new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  activityLog.unshift(`[${time}] ${String(message).slice(0, 100)}`);
  if (activityLog.length > 6) activityLog.length = 6;
}

function isTelemetryFresh() {
  return Boolean(state.updatedAt && Date.now() - state.updatedAt < 15000);
}
const panelFile = path.resolve(".panel.json");

try {
  if (fs.existsSync(panelFile)) panelRef = JSON.parse(fs.readFileSync(panelFile, "utf8"));
} catch {
  panelRef = null;
}

function authorizedApi(req, res, next) {
  const header = req.headers.authorization || "";
  const expected = `Bearer ${BRIDGE_TOKEN}`;
  if (header.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function isAdmin(userId) {
  return ADMIN_IDS.has(userId);
}

function cleanWorld(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 24);
}

function makeEmbed() {
  const online = state.online && isTelemetryFresh();
  const activity = activityLog.length
    ? activityLog.map(line => line.replace(/[`]/g, "'")).join("\n")
    : "[--:--:--] Waiting for activity";
  const embed = new EmbedBuilder()
    .setColor(online ? 0x2ecc71 : 0xe0a12b)
    .setTitle("⚡ LUCIFER SYSTEM")
    .setDescription([
      "```text",
      `STATUS       : ${online ? "ONLINE" : "OFFLINE"}`,
      `BOT          : ${state.botName}`,
      `WORLD        : ${state.world}`,
      `POSITION     : ${state.x ?? "-"}, ${state.y ?? "-"}`,
      `LAST ACTION  : ${state.lastAction}`,
      `CONNECTION   : ${online ? "CONNECTED" : "WAITING"}`,
      `LAST UPDATE  : ${state.updatedAt ? new Date(state.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" }) + " WIB" : "-"}`,
      "```",
      "**LIVE ACTIVITY**",
      "```text",
      activity,
      "```"
    ].join("\n"))
    .setFooter({ text: "DanKudo Monitor • Live telemetry" });
  return embed;
}

function makeComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("lucifer:world").setLabel("WORLD").setEmoji("🌎").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("lucifer:refresh").setLabel("REFRESH").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("lucifer:info").setLabel("INFO").setEmoji("ℹ️").setStyle(ButtonStyle.Secondary)
  );
  return [row];
}

async function updatePanel() {
  if (!panelRef?.channelId || !panelRef?.messageId) return;
  try {
    const channel = await client.channels.fetch(panelRef.channelId);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(panelRef.messageId);
    await message.edit({ embeds: [makeEmbed()], components: makeComponents() });
  } catch (error) {
    console.error("[panel] update failed:", error.message);
  }
}

function queueNavigation(world, requestedBy) {
  pendingCommand = {
    id: crypto.randomUUID().replaceAll("-", ""),
    type: "navigate",
    world,
    requestedBy,
    createdAt: Date.now()
  };
  return pendingCommand;
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "lucifer-discord-controller" }));

app.post("/api/status", authorizedApi, async (req, res) => {
  const body = req.body || {};
  const nextOnline = body.online === true;
  const nextBotName = String(body.botName || "Unknown").slice(0, 40);
  const nextWorld = String(body.world || "-").slice(0, 24);
  const nextAction = String(body.lastAction || "Heartbeat").slice(0, 80);

  if (nextOnline !== lastHeartbeatOnline) {
    addActivity(nextOnline ? `Bot online: ${nextBotName}` : "Bot reported offline");
    lastHeartbeatOnline = nextOnline;
  }
  if (state.botName !== "Waiting for Lua bridge" && nextBotName !== state.botName) {
    addActivity(`Bot changed: ${nextBotName}`);
  }
  if (nextWorld !== "-" && state.world !== "-" && nextWorld !== state.world) {
    addActivity(`World changed: ${state.world} → ${nextWorld}`);
  }
  if (nextAction !== state.lastAction && nextAction !== "Monitoring active" && nextAction !== "Heartbeat") {
    addActivity(nextAction);
  }

  state.online = nextOnline;
  state.botName = nextBotName;
  state.world = nextWorld;
  state.x = Number.isFinite(Number(body.x)) ? Math.trunc(Number(body.x)) : null;
  state.y = Number.isFinite(Number(body.y)) ? Math.trunc(Number(body.y)) : null;
  state.lastAction = nextAction;
  state.updatedAt = Date.now();
  await updatePanel();
  res.json({ ok: true, receivedAt: state.updatedAt });
});

app.get("/api/commands/poll", authorizedApi, (req, res) => {
  if (req.query.botId !== BOT_ID || !pendingCommand) return res.type("text/plain").send("");
  if (Date.now() - pendingCommand.createdAt > 60000) {
    pendingCommand = null;
    return res.type("text/plain").send("");
  }
  res.type("text/plain").send(`${pendingCommand.id}|${pendingCommand.type}|${pendingCommand.world}`);
});

app.post("/api/commands/ack", authorizedApi, (req, res) => {
  const id = String(req.body?.id || "");
  if (pendingCommand && id === pendingCommand.id) {
    pendingCommand = null;
    return res.json({ ok: true });
  }
  res.status(404).json({ error: "command_not_found" });
});

app.listen(PORT, HOST, () => {
  console.log(`[api] listening on http://${HOST}:${PORT}`);
});

const panelCommand = new SlashCommandBuilder()
  .setName("lucifer-panel")
  .setDescription("Post the Lucifer live status panel in this channel.");

client.once("ready", async () => {
  console.log(`[discord] logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [panelCommand.toJSON()] });
  console.log("[discord] slash command registered");
  await updatePanel();
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "lucifer-panel") {
      if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: "You are not allowed to manage this panel.", ephemeral: true });
      }
      const message = await interaction.channel.send({ embeds: [makeEmbed()], components: makeComponents() });
      panelRef = { channelId: message.channelId, messageId: message.id };
      fs.writeFileSync(panelFile, JSON.stringify(panelRef, null, 2));
      return interaction.reply({ content: "Lucifer panel created.", ephemeral: true });
    }

    if (interaction.isButton()) {
      if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: "You are not allowed to use this control.", ephemeral: true });
      }
      if (interaction.customId === "lucifer:refresh") {
        await interaction.update({ embeds: [makeEmbed()], components: makeComponents() });
        return;
      }
      if (interaction.customId === "lucifer:info") {
        return interaction.reply({
          content: `Bot: **${state.botName}**\nWorld: **${state.world}**\nPosition: **${state.x ?? "-"}, ${state.y ?? "-"}**\nConnection: **${state.online ? "Online" : "Offline"}**`,
          ephemeral: true
        });
      }
      if (interaction.customId === "lucifer:world") {
        const modal = new ModalBuilder().setCustomId("lucifer:world-modal").setTitle("Set World");
        const field = new TextInputBuilder()
          .setCustomId("world_name")
          .setLabel("Masukkan nama world")
          .setPlaceholder("Contoh: MYOWNWORLD")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(24)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(field));
        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === "lucifer:world-modal") {
      if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: "You are not allowed to use this control.", ephemeral: true });
      }
      const world = cleanWorld(interaction.fields.getTextInputValue("world_name"));
      if (!world || !ALLOWED_WORLDS.has(world)) {
        return interaction.reply({
          content: "World tidak ada dalam ALLOWED_WORLDS. Tambahkan hanya world milik lu atau yang memang boleh lu akses.",
          ephemeral: true
        });
      }
      if (!state.online) {
        return interaction.reply({ content: "Lua bridge sedang offline. Perintah belum dikirim.", ephemeral: true });
      }
      queueNavigation(world, interaction.user.id);
      await interaction.reply({ content: `Perintah navigasi ke **${world}** masuk antrean.`, ephemeral: true });
      await updatePanel();
    }
  } catch (error) {
    console.error("[interaction] error:", error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Terjadi kesalahan saat memproses interaksi.", ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
