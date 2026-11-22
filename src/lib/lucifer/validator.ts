import luaparse from "luaparse";
import { WHITELIST } from "./whitelist.js";
export type Violation = { rule: string; line: number; message: string };
type Node = { type?: string; loc?: { start?: { line?: number } }; [key: string]: any };
const actionNames = new Set(["hit","place","warp","moveTo","moveTile","say","use","wear","drop","trash","connect","disconnect","leaveWorld","enter","active","respawn"]);
const lookupNames = new Set(["getWorld","getTile","getPlayer","getInventory","getObject","getNPC","getItem"]);
const transitionNames = new Set(["warp","connect","disconnect","leaveWorld"]);
const lineOf = (n: Node) => n.loc?.start?.line || 1;
function walk(n: any, fn: (node: Node, parent?: Node) => void, parent?: Node) {
  if (!n || typeof n !== "object") return;
  if (typeof n.type === "string") fn(n, parent);
  for (const [k,v] of Object.entries(n)) {
    if (k === "loc" || k === "range" || k === "comments" || k === "tokens") continue;
    if (Array.isArray(v)) for (const child of v) walk(child, fn, n);
    else if (v && typeof v === "object") walk(v, fn, n);
  }
}
function callName(n: any): string {
  if (!n) return "";
  if (n.type === "Identifier") return n.name;
  if (n.type === "MemberExpression") return n.identifier?.name || n.property?.name || "";
  return "";
}
function memberBase(n: any): string {
  if (n?.type === "MemberExpression") return n.base?.name || n.object?.name || "";
  return "";
}
export function validate(src: string, opts: { allowRaw?: boolean } = {}): Violation[] {
  const out: Violation[] = [];
  let ast: any;
  try { ast = luaparse.parse(src, { luaVersion: "5.1", locations: true }); }
  catch (e: any) { out.push({rule:"SYNTAX",line:e?.line || e?.loc?.line || 1,message:e?.message || "Lua syntax tidak valid"}); return out; }
  const add = (rule:string,node:any,message:string) => out.push({rule,line:lineOf(node || {}),message});
  const nodes: Node[] = [];
  walk(ast, n => nodes.push(n));
  const calls = nodes.filter(n => n.type === "CallExpression");
  const firstAdd = calls.find(n => callName(n.base) === "addEvent");
  const firstListen = calls.find(n => callName(n.base) === "listenEvents");
  for (const c of calls) {
    const name = callName(c.base);
    if (!name) continue;
    const root = c.base?.type === "MemberExpression" ? (c.base.base?.name || c.base.object?.name || "") : "";
    const luaLibraryCall = ["math","string","table","coroutine","os","io","debug","utf8"].includes(root) && WHITELIST.standardGlobals.has(name);
    if (!WHITELIST.all.has(name) && !luaLibraryCall) add("WHITELIST",c,"Pemanggilan API tidak ditemukan di dokumentasi Lucifer atau standard library Lua: " + name + ".");
    if ((name === "sendPacket" || name === "sendRaw") && !opts.allowRaw) add("K7",c,"Raw packet hanya boleh saat allowRaw=true dan diminta eksplisit.");
    if (actionNames.has(name)) {
      const p = nodes.find(n => n.type === "IfStatement" && JSON.stringify(n).includes(JSON.stringify(c.base)));
      if (p) add("K1",c,`Return bot:${name}() tidak boleh dipakai sebagai kondisi sukses.`);
      const parentAssignment = nodes.find(n => n.type === "AssignmentStatement" && JSON.stringify(n).includes(JSON.stringify(c.base)));
      if (parentAssignment) {
        const assigned = (parentAssignment.variables || []).find((v:any)=>v.type==="Identifier")?.name;
        if (assigned && nodes.some(n => (n.type === "IfStatement" || n.type === "WhileStatement") && JSON.stringify(n).includes(assigned))) add("K1",c,`Return bot:${name}() disimpan lalu dipakai sebagai kondisi.`);
      }
    }
  }
  if (firstAdd && firstListen && lineOf(firstListen) < lineOf(firstAdd)) add("K3",firstListen,"listenEvents() dipanggil sebelum addEvent().");
  const eventCalls = calls.filter(n=>callName(n.base)==="addEvent");
  for (const ev of eventCalls) {
    const callback = (ev.arguments || []).find((a:any)=>a.type==="FunctionDeclaration");
    if (callback) {
      let heavy = false;
      walk(callback.body, n => { if (n.type==="WhileStatement" || n.type==="ForNumericStatement" || n.type==="ForGenericStatement") heavy=true; if (n.type==="CallExpression" && callName(n.base)==="sleep") heavy=true; });
      if (heavy) add("K3",ev,"Callback addEvent tidak boleh berisi sleep atau loop.");
    }
  }
  if (eventCalls.length && !calls.some(n=>["removeEvent","removeEvents"].includes(callName(n.base)))) add("K3",eventCalls[0],"Event didaftarkan tetapi tidak ada cleanup removeEvent/removeEvents.");
  for (const n of nodes) {
    if (n.type === "ForNumericStatement" && n.start?.type === "NumericLiteral" && n.start.value === 0 && n.end?.type === "UnaryExpression" && n.end.argument?.type === "LengthExpression") add("K4",n,"Loop array dimulai dari 0; Lua memakai indexing 1-based.");
    if (n.type === "IndexExpression" && n.index?.type === "NumericLiteral" && n.index.value === 0) add("K4",n,"Index array [0] tidak valid untuk array Lua 1-based.");
  }
  const sourceLines = src.split(/\r?\n/);
  sourceLines.forEach((line,i) => {
    if (/\b(?:status|setBubble|startRole|addEvent|setMethod)\s*(?:==|~=|\()\s*\d+/.test(line)) out.push({rule:"K5",line:i+1,message:"Gunakan enum simbolik, bukan angka mentah."});
  });
  for (const n of nodes) {
    if (n.type === "LocalStatement" || n.type === "AssignmentStatement") {
      const init = n.init || [];
      const vars = n.variables || [];
      init.forEach((value:any,i:number) => {
        if (value?.type==="CallExpression" && lookupNames.has(callName(value.base))) {
          const id=vars[i]?.name;
          if (!id) return;
          const trans = calls.find(c=>transitionNames.has(callName(c.base)) && lineOf(c)>lineOf(n));
          if (trans && nodes.some(x=>x.type==="MemberExpression" && memberBase(x)===id && lineOf(x)>lineOf(trans))) add("K2",trans,`Snapshot '${id}' digunakan lagi setelah transisi world/koneksi; query ulang state.`);
        }
      });
    }
  }
  for (const n of nodes) {
    if (n.type === "MemberExpression" && n.base?.type === "CallExpression" && lookupNames.has(callName(n.base.base))) {
      const parent = nodes.find(x=>x.type==="IfStatement" && JSON.stringify(x.test).includes(JSON.stringify(n.base)));
      if (!parent) add("K6",n,"Hasil lookup berpotensi nil; simpan ke variabel dan guard sebelum akses.");
    }
  }
  // Conservative source-level checks complement the AST checks for common Lua idioms.
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/\bif\s+\w+\s*:\s*(?:hit|place|warp|moveTo|moveTile|say|use|wear|drop|trash|connect|disconnect|leaveWorld|enter|active|respawn)\s*\(/.test(line)) out.push({rule:"K1",line:i+1,message:"Jangan gunakan return aksi fire-and-forget sebagai kondisi."});
    if (/\bfor\s+\w+\s*=\s*0\s*,\s*#/.test(line) || /\[[ ]*0[ ]*\]/.test(line)) out.push({rule:"K4",line:i+1,message:"Array Lua menggunakan index 1-based."});
    if (/\b(?:status|setBubble|startRole|addEvent|setMethod)\s*(?:==|~=|\()\s*\d+/.test(line)) out.push({rule:"K5",line:i+1,message:"Gunakan enum simbolik, bukan angka mentah."});
    if (/\b(?:sendPacket|sendRaw)\s*\(/.test(line) && !opts.allowRaw) out.push({rule:"K7",line:i+1,message:"Raw packet hanya boleh saat allowRaw=true."});
  });
  const transitions = [...src.matchAll(/\b(?:warp|connect|disconnect|leaveWorld)\s*\(/g)];
  for (const tr of transitions) {
    const before = src.slice(0,tr.index);
    const after = src.slice((tr.index||0)+tr[0].length);
    const bound = [...before.matchAll(/local\s+(\w+)\s*=\s*\w+\s*:\s*(?:getWorld|getTile|getPlayer|getInventory|getObject|getNPC)\s*\(/g)].at(-1)?.[1];
    if (bound && new RegExp("\\b"+bound+"\\s*\.").test(after)) out.push({rule:"K2",line:src.slice(0,tr.index).split("\n").length,message:"Snapshot objek dipakai setelah transisi; query ulang state."});
  }
  const eventBody = src.match(/addEvent\s*\([\s\S]*?function\s*\([^)]*\)[\s\S]*?end/);
  if (eventBody && /\bsleep\s*\(|\bwhile\b|\bfor\s+\w+\s*=/.test(eventBody[0])) out.push({rule:"K3",line:src.slice(0,eventBody.index).split("\n").length,message:"Callback event tidak boleh sleep atau menjalankan loop."});
  const lookupAssign = src.match(/local\s+(\w+)\s*=\s*[^\n]*(?:getWorld|getTile|getPlayer|getInventory|getObject|getNPC)\s*\([^\n]*\)/);
  if (lookupAssign && new RegExp("\\b"+lookupAssign[1]+"\\s*\.").test(src.slice((lookupAssign.index||0)+lookupAssign[0].length)) && !new RegExp("if\\s+"+lookupAssign[1]+"\\s+then|if\\s+"+lookupAssign[1]+"\\s*~=").test(src)) out.push({rule:"K6",line:src.slice(0,lookupAssign.index).split("\n").length,message:"Lookup berpotensi nil; guard sebelum akses properti."});
  return out.filter((v,i,a)=>a.findIndex(x=>x.rule===v.rule&&x.line===v.line)===i);
}