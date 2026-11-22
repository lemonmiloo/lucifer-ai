import { verifySupabaseRequest } from "../lib/auth.js";

async function getRows(url,secret,table,query) {
  const base=url.replace(/\/$/,"")+"/rest/v1/"+table+"?"+query;
  const rows=[];
  const pageSize=1000;
  for(let offset=0;offset<10000;offset+=pageSize){
    const r=await fetch(base,{
      headers:{
        apikey:secret,
        ...(secret.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+secret}),
        Range:offset+"-"+(offset+pageSize-1),
        "Range-Unit":"items"
      },
      signal:AbortSignal.timeout(12000)
    });
    if(!r.ok)throw new Error("Database query failed for "+table+": "+r.status+" "+(await r.text()).slice(0,240));
    const page=await r.json();
    rows.push(...page);
    if(page.length<pageSize)break;
  }
  return rows;
}
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  try {
    const auth=await verifySupabaseRequest(req);
    if(!auth.user)return res.status(auth.status||401).json({error:auth.error||"Unauthorized"});
    if(auth.role!=="admin")return res.status(403).json({error:"Akses khusus admin."});
    const url=process.env.SUPABASE_URL;
    const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!secret)return res.status(503).json({error:"Konfigurasi Supabase belum lengkap di Vercel."});
    const [visitors,conversations,messages,accounts,loginEvents]=await Promise.all([
      getRows(url,secret,"lucifer_visitors","select=visitor_id,first_seen,last_seen&order=last_seen.desc"),
      getRows(url,secret,"lucifer_conversations","select=id,visitor_id,title,created_at,updated_at&order=updated_at.desc"),
      getRows(url,secret,"lucifer_messages","select=id,conversation_id,role,content,model,prompt_tokens,completion_tokens,created_at&order=created_at.asc"),
      getRows(url,secret,"dankudo_accounts","select=user_id,username,created_at&order=created_at.desc"),
      getRows(url,secret,"dankudo_login_events","select=id,user_id,username,device_id,logged_at,user_agent&order=logged_at.desc")
    ]);
    return res.status(200).json({visitors,conversations,messages,accounts,loginEvents});
  } catch(err) {
    console.error("Admin dashboard error:",err);
    return res.status(502).json({error:"Gagal mengambil data dashboard dari Supabase."});
  }
}
