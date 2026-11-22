import type { VercelRequest,VercelResponse } from "@vercel/node";
import { runPipeline } from "../src/lib/lucifer/pipeline.js";
export const config={maxDuration:120};
export default async function handler(req:VercelRequest,res:VercelResponse) {
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const prompt=typeof req.body?.prompt==="string"?req.body.prompt.trim():"";
  if(!prompt) return res.status(400).json({error:"prompt wajib diisi"});
  const allowRaw=req.body?.allowRaw===true && /raw packet|sendpacket|sendraw/i.test(prompt);
  try { const result=await runPipeline(prompt,allowRaw); return res.status(200).json(result); }
  catch(e:any) { return res.status(502).json({error:e?.message||"Generator gagal memproses permintaan."}); }
}