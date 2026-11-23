import { verifySupabaseRequest } from "../lib/auth.js";

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  const auth=await verifySupabaseRequest(req).catch(()=>({user:null,status:503}));
  if(!auth.user)return res.status(auth.status||401).json({error:"Sesi login tidak valid."});
  const jobId=typeof req.body?.jobId==="string"?req.body.jobId:"";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId))return res.status(400).json({error:"ID pekerjaan tidak valid."});
  const url=process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)return res.status(503).json({error:"Database tidak tersedia."});
  const root=url.replace(/\/$/,"");
  const response=await fetch(root+"/rest/v1/dankudo_ai_jobs?id=eq."+encodeURIComponent(jobId)+"&user_id=eq."+encodeURIComponent(auth.user.id)+"&status=in.(queued,processing)",{
    method:"PATCH",
    headers:{apikey:secret,...(secret.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+secret}),"Content-Type":"application/json",Prefer:"return=minimal"},
    body:JSON.stringify({status:"cancelled",error:"Dihentikan oleh pengguna.",updated_at:new Date().toISOString()}),
    signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)return res.status(502).json({error:"Gagal menghentikan pekerjaan."});
  return res.status(200).json({ok:true});
}