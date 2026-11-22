import fs from "node:fs";
import path from "node:path";
import { validate } from "../src/lib/lucifer/validator.js";
const expected:Record<string,string>={ "k1.lua":"K1","k2.lua":"K2","k3.lua":"K3","k4.lua":"K4","k5.lua":"K5","k6.lua":"K6","k7.lua":"K7","whitelist.lua":"WHITELIST","syntax.lua":"SYNTAX" };
let passed=0,failed=0,goodCount=0,badCount=0;
for(const kind of ["good","bad"]) {
 const dir=path.join(process.cwd(),"eval",kind);
 for(const file of fs.readdirSync(dir).filter(x=>x.endsWith(".lua"))) {
  const violations=validate(fs.readFileSync(path.join(dir,file),"utf8"));
  let ok:boolean;
  if(kind==="good"){goodCount++;ok=violations.length===0;}
  else {badCount++;const rule=expected[file];ok=!!rule&&violations.some(v=>v.rule===rule);}
  if(ok) passed++; else {failed++;console.error(`FAIL ${kind}/${file}: expected ${kind==="good"?"0 violations":expected[file]}, got ${JSON.stringify(violations)}`);}
 }
}
console.log(`Eval: ${passed} passed, ${failed} failed (good ${goodCount}, bad ${badCount})`);
if(failed) process.exit(1);