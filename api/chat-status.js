import { verifySupabaseRequest } from "../lib/auth.js";

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  const auth=await verifySupabaseRequest(req).catch(()=>({user:null,status:503}));
  if(!auth.user)return res.status(auth.status||401).json({error:"Sesi login tidak valid."});
  const jobId=typeof req.query?.jobId==="string"?req.query.jobId:"";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId))return res.status(400).json({error:"ID pekerjaan tidak valid."});
  const url=process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)return res.status(503).json({error:"Database tidak tersedia."});
  const r=await fetch(url.replace(/\/$/,"")+"/rest/v1/dankudo_ai_jobs?id=eq."+encodeURIComponent(jobId)+"&user_id=eq."+encodeURIComponent(auth.user.id)+"&select=status,answer,result_title,sources,search_steps,duration_ms,error,updated_at,completed_at",{
    headers:{apikey:secret,...(secret.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+secret})},
    signal:AbortSignal.timeout(7000)
  });
  if(!r.ok)return res.status(502).json({error:"Gagal memeriksa status jawaban."});
  const rows=await r.json();
  if(!rows.length)return res.status(404).json({error:"Pekerjaan tidak ditemukan."});
  const job=rows[0];
  return res.status(200).json({status:job.status,answer:job.answer,title:job.result_title,sources:Array.isArray(job.sources)?job.sources:[],searchSteps:Array.isArray(job.search_steps)?job.search_steps:[],durationMs:job.duration_ms,error:job.error,updatedAt:job.updated_at,completedAt:job.completed_at});
}
