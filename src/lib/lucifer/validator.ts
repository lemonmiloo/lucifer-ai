import luaparse from "luaparse";
import { WHITELIST } from "./whitelist.js";

export type Violation = { rule: string; line: number; message: string };
type AstNode = { type?: string; loc?: { start?: { line?: number } }; range?: [number, number]; [key: string]: any };

const ACTIONS = new Set(["hit","place","warp","moveTo","moveTile","say","use","wear","drop","trash","connect","disconnect","leaveWorld","enter","active","respawn"]);
const LOOKUPS = new Set(["getWorld","getTile","getPlayer","getInventory","getObject","getNPC","getItem","getExtra","getInfo"]);
const TRANSITIONS = new Set(["warp","connect","disconnect","leaveWorld"]);

function walk(node: any, visit: (node: AstNode, parent?: AstNode) => void, parent?: AstNode): void {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (["loc","range","comments","tokens"].includes(key)) continue;
    if (Array.isArray(value)) for (const child of value) walk(child, visit, node);
    else if (value && typeof value === "object") walk(value, visit, node);
  }
}
function nameOf(node: any): string {
  if (!node) return "";
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") return node.identifier?.name || node.property?.name || "";
  return "";
}
function rootOf(node: any): string {
  if (node?.type !== "MemberExpression") return "";
  return node.base?.name || node.object?.name || "";
}
function lineOf(node: AstNode | undefined): number { return node?.loc?.start?.line || 1; }
function startOf(node: AstNode | undefined): number { return node?.range?.[0] ?? 0; }
function endOf(node: AstNode | undefined): number { return node?.range?.[1] ?? 0; }
function contains(node: any, predicate: (n: AstNode) => boolean): boolean {
  let found = false;
  walk(node, n => { if (predicate(n)) found = true; });
  return found;
}
function isLengthExpression(node: any): boolean {
  return contains(node, n => n.type === "LengthExpression");
}
function isLookupCall(node: any): boolean {
  return node?.type === "CallExpression" && LOOKUPS.has(nameOf(node.base));
}
function isActionCall(node: any): boolean {
  return node?.type === "CallExpression" && ACTIONS.has(nameOf(node.base));
}
function isPositiveNilGuard(condition: any, variable: string): boolean {
  if (condition?.type === "Identifier" && condition.name === variable) return true;
  if (condition?.type === "BinaryExpression" && condition.operator === "~=") {
    return condition.left?.type === "Identifier" && condition.left.name === variable && condition.right?.type === "NilLiteral" ||
      condition.right?.type === "Identifier" && condition.right.name === variable && condition.left?.type === "NilLiteral";
  }
  if (condition?.type === "LogicalExpression" && condition.operator === "and") {
    return isPositiveNilGuard(condition.left, variable);
  }
  return false;
}
function hasNilGuard(src: string, variable: string, after: number, nodes: AstNode[], use: AstNode): boolean {
  const guardedBranch = nodes.some(node =>
    node.type === "IfStatement" &&
    (node.clauses || []).some((clause: any) =>
      isPositiveNilGuard(clause.condition, variable) &&
      (contains(clause.body, child => child === use) || contains(clause.condition, child => child === use))
    )
  );
  const prefix = src.slice(0, after);
  const context = prefix.slice(Math.max(0, prefix.lastIndexOf("\n", after - 1) - 300));
  const positiveGuard = new RegExp("\\bif\\s+" + variable + "\\s+(?:then\\b|and\\b)").test(context);
  const comparisonGuard = new RegExp("\\bif\\s+" + variable + "\\s*~=\\s*nil\\s+then\\b").test(context);
  const earlyReturn = new RegExp("\\bif\\s+not\\s+" + variable + "\\s+then\\s+return\\b[\\s\\S]*?\\bend\\b").test(prefix);
  return guardedBranch || positiveGuard || comparisonGuard || earlyReturn;
}
export function validate(src: string, opts: { allowRaw?: boolean } = {}): Violation[] {
  const violations: Violation[] = [];
  const add = (rule: string, node: AstNode | undefined, message: string) => {
    const line = lineOf(node);
    if (!violations.some(v => v.rule === rule && v.line === line && v.message === message)) violations.push({ rule, line, message });
  };

  let ast: any;
  try {
    ast = luaparse.parse(src, { luaVersion: "5.1", locations: true, ranges: true });
  } catch (error: any) {
    violations.push({ rule: "SYNTAX", line: error?.line || error?.loc?.line || 1, message: error?.message || "Sintaks Lua 5.1 tidak valid." });
    return violations;
  }

  const nodes: AstNode[] = [];
  walk(ast, node => nodes.push(node));
  const calls = nodes.filter(node => node.type === "CallExpression");
  const sourceLines = src.split(/\r?\n/);

  // K8: calls must resolve to documented API names or Lua 5.1 standard library.
  for (const call of calls) {
    const called = nameOf(call.base);
    if (!called) continue;
    const receiver = rootOf(call.base);
    const isStandardMember = ["math","string","table","coroutine","os","io","debug","utf8"].includes(receiver) && WHITELIST.standardGlobals.has(called);
    const isConstructor = called === "new" && WHITELIST.moduleConstructors.has(receiver);
    const allowed = call.base?.type === "Identifier"
      ? WHITELIST.globalFns.has(called) || WHITELIST.standardGlobals.has(called) || WHITELIST.moduleNames.has(called)
      : WHITELIST.allMethods.has(called) || WHITELIST.globalFns.has(called) || WHITELIST.standardMembers.has(called) || isStandardMember || isConstructor;
    if (!allowed) add("WHITELIST", call, "Pemanggilan tidak ditemukan di dokumentasi Lucifer atau Lua standard library: " + called + ".");
  }

  // Enum members must be declared in the documented enum value set.
  for (const node of nodes) {
    if (node.type !== "MemberExpression") continue;
    const namespace = node.base?.name || node.object?.name || "";
    const member = nameOf(node);
    if (WHITELIST.enums.has(namespace) && !WHITELIST.enumValues.has(member)) {
      add("WHITELIST", node, `Enum ${namespace}.${member} tidak ditemukan di dokumentasi.`);
    }
  }

  // K1: fire-and-forget results cannot be used as booleans or success indicators.
  for (const node of nodes) {
    if (node.type === "IfStatement" && (node.clauses || []).some((clause: any) => contains(clause.condition, n => n.type === "CallExpression" && isActionCall(n)))) {
      add("K1", node, "Return aksi fire-and-forget tidak boleh menjadi kondisi if.");
    }
    if (node.type === "WhileStatement" && contains(node.condition, n => n.type === "CallExpression" && isActionCall(n))) {
      add("K1", node, "Return aksi fire-and-forget tidak boleh menjadi kondisi while.");
    }
    if (node.type === "LocalStatement" || node.type === "AssignmentStatement") {
      const vars = node.variables || [];
      const init = node.init || [];
      init.forEach((value: any, index: number) => {
        if (!isActionCall(value)) return;
        const variable = vars[index]?.name;
        if (!variable) return;
        const laterCondition = nodes.find(candidate =>
          (candidate.type === "IfStatement" && (candidate.clauses || []).some((clause: any) => contains(clause.condition, n => n.type === "Identifier" && n.name === variable)) ||
           candidate.type === "WhileStatement" && contains(candidate.condition, n => n.type === "Identifier" && n.name === variable)) &&
          startOf(candidate) > endOf(node));
        if (laterCondition) add("K1", node, "Return aksi fire-and-forget disimpan lalu dipakai sebagai kondisi.");
      });
    }
  }

  // K2: snapshots acquired before a world/connection transition must not be reused after it.
  const bindings: Array<{ name: string; node: AstNode }> = [];
  for (const node of nodes) {
    if (node.type !== "LocalStatement" && node.type !== "AssignmentStatement") continue;
    (node.init || []).forEach((value: any, index: number) => {
      if (contains(value, n => n.type === "CallExpression" && isLookupCall(n))) {
        const name = node.variables?.[index]?.name;
        if (name) bindings.push({ name, node });
      }
    });
  }
  const transitions = calls.filter(call => TRANSITIONS.has(nameOf(call.base)));
  for (const binding of bindings) {
    for (const transition of transitions) {
      if (startOf(transition) <= endOf(binding.node)) continue;
      const rebind = nodes.find(node =>
        (node.type === "LocalStatement" || node.type === "AssignmentStatement") &&
        startOf(node) > endOf(transition) &&
        (node.variables || []).some((v: any) => v?.name === binding.name));
      const use = nodes.find(node =>
        node.type === "MemberExpression" &&
        (node.base?.name || node.object?.name) === binding.name &&
        startOf(node) > endOf(transition) &&
        (!rebind || startOf(node) < startOf(rebind)));
      if (use) add("K2", transition, `Snapshot '${binding.name}' dipakai setelah transisi; query ulang state dan objek dari bot:getWorld().`);
    }
  }

  // K3: event registration order, lightweight callbacks, and cleanup.
  const addEvents = calls.filter(call => nameOf(call.base) === "addEvent");
  const listenCalls = calls.filter(call => nameOf(call.base) === "listenEvents");
  if (addEvents.length && listenCalls.length && addEvents.some(event => startOf(event) > startOf(listenCalls[0]))) {
    add("K3", listenCalls[0], "listenEvents() dipanggil sebelum addEvent().");
  }
  for (const eventCall of addEvents) {
    const callback = (eventCall.arguments || []).find((arg: any) => arg.type === "FunctionDeclaration");
    if (callback && contains(callback.body, n =>
      n.type === "WhileStatement" || n.type === "RepeatStatement" ||
      n.type === "ForNumericStatement" || n.type === "ForGenericStatement" ||
      n.type === "CallExpression" && nameOf(n.base) === "sleep")) {
      add("K3", eventCall, "Callback addEvent tidak boleh sleep atau menjalankan loop.");
    }
  }
  if (addEvents.length && !calls.some(call => ["removeEvent","removeEvents"].includes(nameOf(call.base)) && startOf(call) > Math.max(...addEvents.map(event => startOf(event))))) {
    add("K3", addEvents[0], "Event didaftarkan tetapi tidak ada cleanup removeEvent/removeEvents.");
  }

  // K4: arrays in Lua are 1-based.
  for (const node of nodes) {
    if (node.type === "ForNumericStatement" &&
        node.start?.type === "NumericLiteral" && node.start.value === 0 &&
        isLengthExpression(node.end)) {
      add("K4", node, "Loop array dimulai dari 0; gunakan indeks 1-based.");
    }
    if (node.type === "IndexExpression" && node.index?.type === "NumericLiteral" && node.index.value === 0) {
      add("K4", node, "Index [0] tidak valid untuk array Lua 1-based.");
    }
  }

  // K5: enum arguments/status comparisons must be symbolic.
  for (const call of calls) {
    const called = nameOf(call.base);
    const first = call.arguments?.[0];
    if (["setBubble","startRole","setMethod","addEvent"].includes(called) && first?.type === "NumericLiteral") {
      add("K5", call, `Gunakan enum simbolik pada argumen ${called}(), bukan angka mentah.`);
    }
  }
  for (const node of nodes) {
    if (node.type === "BinaryExpression" && ["==","~="].includes(node.operator)) {
      const left = node.left, right = node.right;
      const statusComparison = left?.type === "MemberExpression" && nameOf(left) === "status" && right?.type === "NumericLiteral" ||
        right?.type === "MemberExpression" && nameOf(right) === "status" && left?.type === "NumericLiteral";
      if (statusComparison) add("K5", node, "Bandingkan bot.status dengan BotStatus simbolik, bukan angka.");
    }
  }

  // K6: nil-capable lookups need a guard before their result is dereferenced.
  for (const call of calls.filter(isLookupCall)) {
    const parentUse = nodes.find(node => node.type === "MemberExpression" && node.base === call);
    if (parentUse) add("K6", call, "Hasil lookup yang dapat nil dipakai langsung; simpan dan nil-guard sebelum akses lanjutan.");
  }
  for (const binding of bindings) {
    const declaration = binding.node;
    const use = nodes.find(node =>
      node.type === "MemberExpression" &&
      (node.base?.name || node.object?.name) === binding.name &&
      startOf(node) > endOf(declaration));
    if (use && !hasNilGuard(src, binding.name, startOf(use), nodes, use)) {
      add("K6", use, `Lookup '${binding.name}' berpotensi nil; periksa nil sebelum mengakses properti/method.`);
    }
  }

  // K7: raw packets require an explicit user opt-in.
  if (!opts.allowRaw) {
    for (const call of calls) if (["sendPacket","sendRaw"].includes(nameOf(call.base))) {
      add("K7", call, "sendPacket/sendRaw hanya boleh jika pengguna meminta raw packet secara eksplisit.");
    }
  }

  // Source fallback catches common compact syntax that can be hard to infer from a single AST shape.
  sourceLines.forEach((line, index) => {
    if (/\bfor\s+\w+\s*=\s*0\s*,\s*#/.test(line)) {
      add("K4", { loc: { start: { line: index + 1 } } }, "Loop array dimulai dari 0; gunakan indeks 1-based.");
    }
  });

  return violations.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}
