import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { KNOWLEDGE } from "./knowledge.js";
import { FEWSHOT } from "./fewshot.js";
import { validate, type Violation } from "./validator.js";
import { repair } from "./repair.js";
export async function runPipeline(prompt:string,allowRaw=false) {
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error("OPENAI_API_KEY belum diatur di environment Vercel.");
  const model=process.env.OPENAI_MODEL||"gpt-4o";
  const messages=[{role:"system",content:SYSTEM_PROMPT},{role:"system",content:"GROUND TRUTH KNOWLEDGE:\n"+KNOWLEDGE},{role:"system",content:"FEW-SHOT PATTERNS:\n"+FEWSHOT},{role:"user",content:prompt}];
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(60000),body:JSON.stringify({model,temperature:0.2,messages})});
  if(!response.ok) throw new Error(`OpenAI generation failed: HTTP ${response.status}`);
  const data:any=await response.json(); let src=data?.choices?.[0]?.message?.content;
  if(typeof src!=="string"||!src.trim()) throw new Error("Model tidak mengembalikan script.");
  src=src.replace(/^\s*```(?:lua)?\s*/i,"").replace(/\s*```\s*$/,"").trim();
  let violations:Violation[]=validate(src,{allowRaw}),iterations=0;
  while(violations.length&&iterations<3){iterations++;src=await repair(src,violations,apiKey,model);violations=validate(src,{allowRaw});}
  return {script:src,violations,iterations,ok:violations.length===0};
}