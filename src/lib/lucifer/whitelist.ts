import { KNOWLEDGE } from "./knowledge.js";

function collect(re: RegExp, text: string): Set<string> {
  return new Set([...text.matchAll(re)].map(match => match[1]).filter(Boolean));
}

// Only Lua's language/runtime built-ins are static; Lucifer API names are extracted from the source document.
const standardGlobals = new Set([
  "assert","collectgarbage","dofile","error","getmetatable","ipairs","load","loadfile","next","pairs","pcall","print",
  "rawequal","rawget","rawlen","rawset","select","setmetatable","tonumber","tostring","type","unpack","xpcall",
  "_G","_VERSION","math","string","table","coroutine","os","io","debug","utf8"
]);
const standardMembers = new Set([
  "abs","acos","asin","atan","atan2","ceil","cos","deg","exp","floor","fmod","frexp","huge","ldexp","log","log10",
  "max","min","modf","pi","pow","rad","random","randomseed","sin","sqrt","tan",
  "byte","char","dump","find","format","gmatch","gsub","len","lower","match","rep","reverse","sub","upper",
  "concat","insert","maxn","remove","sort","clock","date","difftime","execute","exit","getenv","remove","rename",
  "setlocale","time","tmpname","close","flush","lines","open","read","tmpfile","write","seek","setvbuf"
]);

const globalFns = collect(/(?<![.:])\b([A-Za-z_][A-Za-z0-9_]*)\s*\([^\n\x60]*\)\x60/g, KNOWLEDGE);
const botMethods = collect(/\bbot:([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const worldMethods = collect(/\b(?:world|w):([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const tileMethods = collect(/\b(?:tile|t):([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const invMethods = collect(/\b(?:inv|inventory):([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const otherMethods = collect(/\b(?:gs|client|hook|manager|dialog|r|vl|v|extra|console|log):([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const moduleNames = collect(/\b(auto_[A-Za-z0-9_]+)\b/g, KNOWLEDGE);
const enums = collect(/\b(Platform|Bubble|Role|Action|GeigerArea|StorageType|Method|Proxy|Event|VariantType|BotStatus|CaptchaStatus|GoogleStatus|PlayerState|TileType|TileFlag|NpcType)\b/g, KNOWLEDGE);
const enumValues = new Set<string>();
for (const match of KNOWLEDGE.matchAll(/\|\s*`[A-Z][A-Za-z0-9_]*`\s*\|\s*([^\n]+)/g)) {
  for (const value of match[1].matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)) enumValues.add(value[1]);
}
for (const section of KNOWLEDGE.matchAll(/\*\*(?:Normal|Failure|Info):\*\*([^\n]+)/g)) {
  for (const value of section[1].matchAll(/\b([a-z][a-z0-9_]*)\b/g)) enumValues.add(value[1]);
}
const documentedGlobals = new Set([
  ...globalFns,
  ...collect(/\b(getBot|getBots|addBot|addTokenBot|addUbiBot|addSteamBot|removeBot|getUsername|getBanRate|sleep|read|write|append|removeColor|clearConsole|runThread|getInfo|getInfos|getProxyManager|getWorldManager|getSwitchManager|addProxy|removeProxy|addPack|removePack|getTrashList|setTrashList|getTile|getTiles|getTilesSafe|getObject|getObjects|getPlayer|getPlayers|getNPC|getNPCs|getLocal|hasAccess|getWorld|getInventory|getConsole|getLog|getLogin|getDialog|addEvent|listenEvents|unlistenEvents|removeEvent|removeEvents)\b/g, KNOWLEDGE)
]);
const allMethods = new Set([...botMethods,...worldMethods,...tileMethods,...invMethods,...otherMethods]);
const moduleConstructors = new Set(["variant","variantlist","HttpClient","Webhook","RTVAR"].filter(name => new RegExp("\\b" + name + "\\s*\\.new\\s*\\(").test(KNOWLEDGE)));
const documentedProperties = collect(/`([A-Za-z_][A-Za-z0-9_]*)`/g, KNOWLEDGE);

export const WHITELIST = {
  globalFns: documentedGlobals,
  botMethods, botProps: documentedProperties, worldMethods, tileMethods, invMethods,
  otherMethods, moduleNames, moduleConstructors, enums, enumValues,
  standardGlobals, standardMembers, allMethods,
  all: new Set([...documentedGlobals,...allMethods,...documentedProperties,...moduleNames,...enums,...enumValues,...standardGlobals,...standardMembers])
};
