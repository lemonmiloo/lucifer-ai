import { KNOWLEDGE } from "./knowledge.js";

function collect(re: RegExp, text: string): Set<string> {
  return new Set([...text.matchAll(re)].map(match => match[1]).filter(Boolean));
}

// Lua 5.1 built-ins are separate from Lucifer API names.
const standardGlobals = new Set([
  "assert","collectgarbage","dofile","error","getfenv","getmetatable","ipairs","load","loadfile","module","next","pairs","pcall","print",
  "rawequal","rawget","rawset","select","setfenv","setmetatable","tonumber","tostring","type","unpack","xpcall",
  "_G","_VERSION","math","string","table","coroutine","os","io","debug"
]);
const standardMembers = new Set([
  "abs","acos","asin","atan","atan2","ceil","cos","deg","exp","floor","fmod","frexp","huge","ldexp","log","log10",
  "max","min","modf","pi","pow","rad","random","randomseed","sin","sqrt","tan",
  "byte","char","dump","find","format","gmatch","gsub","len","lower","match","rep","reverse","sub","upper",
  "concat","insert","maxn","remove","sort","clock","date","difftime","execute","exit","getenv","remove","rename",
  "setlocale","time","tmpname","close","flush","lines","open","read","tmpfile","write","seek","setvbuf"
]);

// Extract documented call signatures directly from the ground-truth document.
const globalFns = collect(/(?<![.:])\b([A-Za-z_][A-Za-z0-9_]*)\s*\([^\n\x60]*\)\x60/g, KNOWLEDGE);
const botMethods = collect(/\bbot:([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const worldMethods = collect(/\b(?:world|w):([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const tileMethods = collect(/\b(?:tile|t):([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const invMethods = collect(/\b(?:inv|inventory):([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const otherMethods = collect(/\b(?:gs|client|hook|manager|dialog|r|vl|v|extra|console|log):([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, KNOWLEDGE);
const moduleNames = collect(/\b(auto_[A-Za-z0-9_]+)\b/g, KNOWLEDGE);

const enumSection = KNOWLEDGE.split("## 9. ENUMS")[1]?.split("## 10. TROUBLESHOOTING")[0] || "";
const enums = collect(/\x60([A-Z][A-Za-z0-9_]*)\x60/g, enumSection);
for (const heading of enumSection.matchAll(/^###\s+([A-Z][A-Za-z0-9_]*)/gm)) enums.add(heading[1]);
for (const entry of enumSection.matchAll(/^-\s+([A-Z][A-Za-z0-9_]*)\s*$/gm)) enums.add(entry[1]);

const enumValues = new Set<string>();
for (const match of enumSection.matchAll(/\|\s*\x60[A-Z][A-Za-z0-9_]*\x60\s*\|\s*([^\n]+)/g)) {
  for (const value of match[1].matchAll(/\x60([A-Za-z_][A-Za-z0-9_]*)\x60/g)) enumValues.add(value[1]);
}
for (const section of enumSection.matchAll(/\*\*(?:Normal|Failure|Info):\*\*([^\n]+)/g)) {
  for (const value of section[1].matchAll(/\b([a-z][a-z0-9_]*)\b/g)) enumValues.add(value[1]);
}

const documentedGlobals = new Set(globalFns);
const allMethods = new Set([...botMethods,...worldMethods,...tileMethods,...invMethods,...otherMethods,...globalFns]);
const moduleConstructors = collect(/(?<![.:])\b([A-Za-z_][A-Za-z0-9_]*)\.new\s*\(/g, KNOWLEDGE);
const documentedProperties = collect(/\x60([A-Za-z_][A-Za-z0-9_]*)\x60/g, KNOWLEDGE);


function sectionBetween(start: string, end: string): string {
  const from = KNOWLEDGE.indexOf(start);
  if (from < 0) return "";
  const to = KNOWLEDGE.indexOf(end, from + start.length);
  return KNOWLEDGE.slice(from, to < 0 ? undefined : to);
}
function propertySet(section: string): Set<string> {
  return collect(/\x60([A-Za-z_][A-Za-z0-9_]*)\x60/g, section);
}
const propertiesByType = {
  bot: propertySet(sectionBetween("## 2. BOT OBJECT", "## 3. AUTOMATION MODULES")),
  world: propertySet(sectionBetween("### 4.1 World", "### 4.2 Tile")),
  tile: propertySet(sectionBetween("### 4.2 Tile", "### 4.3 Player")),
  player: propertySet(sectionBetween("### 4.3 Player", "### 4.4 Clothes")),
  inventory: propertySet(sectionBetween("### 4.8 Inventory", "### 4.9 ItemDescription")),
  inventoryitem: propertySet(sectionBetween("### 4.8 Inventory", "### 4.9 ItemDescription")),
  netobject: propertySet(sectionBetween("### 4.5 NetObject", "### 4.6 Login")),
  npc: propertySet(sectionBetween("### 4.5 NetObject", "### 4.6 Login")),
  signal: propertySet(sectionBetween("### 4.7 Signal", "### 4.8 Inventory")),
  growscan: propertySet(sectionBetween("### 4.11 Growscan", "### 4.12 Vector2"))
};

export const WHITELIST = {
  globalFns: documentedGlobals,
  botMethods, botProps: documentedProperties, worldMethods, tileMethods, invMethods,
  otherMethods, moduleNames, moduleConstructors, enums, enumValues,
  standardGlobals, standardMembers, allMethods, propertiesByType,
  all: new Set([...documentedGlobals,...allMethods,...documentedProperties,...moduleNames,...moduleConstructors,...enums,...enumValues,...standardGlobals,...standardMembers])
};
