import fs from "node:fs";
import path from "node:path";
import { validate } from "../src/lib/lucifer/validator.js";
let passed=0,failed=0;
for(const kind of ["good","bad"]) {
 const dir=path.join(process.cwd(),"eval",kind);
 for(const file of fs.readdirSync(dir).filter(x=>x.endsWith(".lua"))) {
  const violations=validate(fs.readFileSync(path.join(dir,file),"utf8"));
  const ok=kind==="good"?violations.length===0:violations.length>0;
  if(ok) passed++; else {failed++;console.error(`FAIL ${kind}/${file}: ${JSON.stringify(violations)}`);}
 }
}
console.log(`Eval: ${passed} passed, ${failed} failed`);
if(failed) process.exit(1);