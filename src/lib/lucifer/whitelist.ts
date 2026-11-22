import { KNOWLEDGE } from "./knowledge.js";

const globalFns = new Set<string>();
const botMethods = new Set<string>();
const botProps = new Set<string>();
const worldMethods = new Set<string>();
const tileMethods = new Set<string>();
const invMethods = new Set<string>();
const moduleNames = new Set<string>();
const enums = new Set<string>();
const enumValues = new Set<string>();

function addMatches(target: Set<string>, text: string, re: RegExp) {
  for (const match of text.matchAll(re)) if (match[1]) target.add(match[1]);
}
addMatches(globalFns, KNOWLEDGE, /\x60([A-Za-z_][A-Za-z0-9_]*)\([^\x60\n]*\)\x60\s*\|/g);
addMatches(botMethods, KNOWLEDGE, /\x60bot:([A-Za-z_][A-Za-z0-9_]*)\(/g);
addMatches(worldMethods, KNOWLEDGE, /\x60(?:world|w):([A-Za-z_][A-Za-z0-9_]*)\(/g);
addMatches(tileMethods, KNOWLEDGE, /\x60(?:tile|t):([A-Za-z_][A-Za-z0-9_]*)\(/g);
addMatches(invMethods, KNOWLEDGE, /\x60(?:inv|inventory):([A-Za-z_][A-Za-z0-9_]*)\(/g);
addMatches(botProps, KNOWLEDGE, /\x60(?:bot\.)?([a-z][A-Za-z0-9_]*)\x60/g);
addMatches(moduleNames, KNOWLEDGE, /\x60(auto_[a-z0-9_]+)\x60/gi);
addMatches(enums, KNOWLEDGE, /\x60([A-Z][A-Za-z0-9_]*)\x60/g);
for (const m of KNOWLEDGE.matchAll(/\|\s*`([A-Z][A-Za-z0-9_]*)`\s*\|\s*`([^\x60]+)`/g)) {
  enums.add(m[1]);
  for (const value of m[2].split(",").map(x => x.trim())) if (/^[a-z_][a-z0-9_]*$/i.test(value)) enumValues.add(value);
}
for (const m of KNOWLEDGE.matchAll(/\x60(BotStatus|CaptchaStatus|GoogleStatus)\x60[\s\S]*?(?=\n### |\n---)/g)) {
  for (const value of m[0].matchAll(/\b([a-z][a-z0-9_]*)\b/g)) enumValues.add(value[1]);
}
const standardGlobals = new Set(["assert","collectgarbage","dofile","error","getmetatable","ipairs","load","loadfile","next","pairs","pcall","print","rawequal","rawget","rawlen","rawset","select","setmetatable","tonumber","tostring","type","unpack","xpcall","_G","_VERSION","math","string","table","coroutine","os","io","debug","utf8","require","floor","ceil","abs","min","max","sqrt","random","format","sub","find","match","gsub","lower","upper","rep","reverse","byte","char","len","insert","remove","sort","concat","date","time","clock","difftime","open","close","read","write"]);
const documentedGlobals = new Set(["getBot","getBots","addBot","addTokenBot","addUbiBot","addSteamBot","removeBot","getUsername","getBanRate","sleep","read","write","append","removeColor","clearConsole","runThread","getInfo","getInfos","getProxyManager","getWorldManager","getSwitchManager","addProxy","removeProxy","addPack","removePack","getTrashList","setTrashList","getTile","getTiles","getTilesSafe","getObject","getObjects","getPlayer","getPlayers","getNPC","getNPCs","getLocal","hasAccess","getWorld","getInventory","getConsole","getLog","getLogin","getDialog","addEvent","listenEvents","unlistenEvents","removeEvent","removeEvents"]);
for (const n of documentedGlobals) globalFns.add(n);
export const WHITELIST = {
  globalFns, botMethods, botProps, worldMethods, tileMethods, invMethods,
  moduleNames, enums, enumValues, standardGlobals,
  all: new Set([...globalFns,...botMethods,...botProps,...worldMethods,...tileMethods,...invMethods,...moduleNames,...enums,...enumValues,...standardGlobals])
};