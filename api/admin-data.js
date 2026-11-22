import { verifySupabaseRequest } from "../lib/auth.js";

async function getRows(url,secret,table,query) {
  const r=await fetch(url.replace(/\/$/, "")+"/rest/v1/"+table+"?"+query,{
    headers:{apikey:secret,...(secret.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+secret})},
    signal:AbortSignal.timeout(10000)
  });
  if(!r.ok) throw new Error("Database query failed: "+r.status);
  return r.json();
}
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  try {
    const auth=await verifySupabaseRequest(req);
    if(!auth.user) return res.status(auth.status||401).json({error:auth.error||"Unauthorized"});
    if(auth.role!=="admin") return res.status(403).json({error:"Akses khusus owner."});
    const url=process.env.SUPABASE_URL;
    const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!secret) return res.status(503).json({error:"Konfigurasi Supabase belum lengkap di Vercel."});
    const [visitors,conversations,messages]=await Promise.all([
      getRows(url,secret,"lucifer_visitors","select=visitor_id,first_seen,last_seen&order=last_seen.desc&limit=500"),
      getRows(url,secret,"lucifer_conversations","select=id,visitor_id,title,created_at,updated_at&order=updated_at.desc&limit=200"),
      getRows(url,secret,"lucifer_messages","select=id,conversation_id,role,content,model,prompt_tokens,completion_tokens,created_at&order=created_at.desc&limit=1000")
    ]);
    return res.status(200).json({visitors,conversations,messages});
  } catch(err) {
    console.error("Admin dashboard error:",err);
    return res.status(502).json({error:"Gagal mengambil data dashboard dari Supabase."});
  }
}
