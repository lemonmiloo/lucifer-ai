import fs from "node:fs";
import path from "node:path";
import { validate } from "../src/lib/lucifer/validator.js";

const expected: Record<string, string> = {
  "k1.lua": "K1",
  "k1-assigned.lua": "K1",
  "k2.lua": "K2",
  "k3.lua": "K3",
  "k3-order.lua": "K3",
  "k4.lua": "K4",
  "k5.lua": "K5",
  "k6.lua": "K6",
  "k7.lua": "K7",
  "whitelist.lua": "WHITELIST",
  "unknown-global.lua": "WHITELIST",
  "syntax.lua": "SYNTAX"
};

let passed = 0;
let failed = 0;
let goodCount = 0;
let badCount = 0;

for (const kind of ["good", "bad"] as const) {
  const directory = path.join(process.cwd(), "eval", kind);
  const files = fs.readdirSync(directory).filter(file => file.endsWith(".lua")).sort();
  for (const file of files) {
    const violations = validate(fs.readFileSync(path.join(directory, file), "utf8"));
    const expectedRule = expected[file];
    const ok = kind === "good" ? violations.length === 0 : !!expectedRule && violations.some(item => item.rule === expectedRule);
    if (kind === "good") goodCount += 1;
    else badCount += 1;
    if (ok) passed += 1;
    else {
      failed += 1;
      console.error(`FAIL ${kind}/${file}: expected ${kind === "good" ? "0 violations" : expectedRule}, got ${JSON.stringify(violations)}`);
    }
  }
}

const rawScript = "local bot = getBot()\\nbot:sendRaw(packet)";
const rawDenied = validate(rawScript).some(item => item.rule === "K7");
const rawAllowed = !validate(rawScript, { allowRaw: true }).some(item => item.rule === "K7");
if (rawDenied) passed += 1; else { failed += 1; console.error("FAIL raw packet must be blocked by default"); }
if (rawAllowed) passed += 1; else { failed += 1; console.error("FAIL raw packet opt-in should permit K7"); }

if (goodCount < 5 || badCount < 8) {
  failed += 1;
  console.error(`Fixture minimum not met: good=${goodCount}, bad=${badCount}`);
}
console.log(`Eval: ${passed} passed, ${failed} failed (good ${goodCount}, bad ${badCount}, raw opt-in 2)`);
if (failed > 0) process.exit(1);
