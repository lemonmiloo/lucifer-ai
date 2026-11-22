import type { Violation } from "./validator.js";
export async function repair(src:string, violations:Violation[], apiKey:string, model:string):Promise<string> {
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(45000),body:JSON.stringify({model,temperature:0.2,messages:[{role:"system",content:"Perbaiki script Lua agar mematuhi K1-K8 dan dokumentasi Lucifer. Keluarkan hanya satu file Lua penuh."},{role:"user",content:`Perbaiki violation berikut, keluarkan SATU file .lua penuh yang sudah benar. Patuhi K1-K8.\nVIOLATIONS:\n${JSON.stringify(violations)}\nSCRIPT:\n${src}`}]})});
  if(!response.ok) throw new Error(`OpenAI repair failed: HTTP ${response.status}`);
  const data:any=await response.json(); const text=data?.choices?.[0]?.message?.content;
  if(typeof text!=="string"||!text.trim()) throw new Error("Model repair tidak mengembalikan script.");
  return text.replace(/^\s*```(?:lua)?\s*/i,"").replace(/\s*```\s*$/,"").trim();
}