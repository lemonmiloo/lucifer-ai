import { verifySupabaseRequest } from "../../lib/auth.js";
import { db } from "../../lib/account-auth.js";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  try{
    const auth=await verifySupabaseRequest(req);
    if(!auth.user)return res.status(auth.status||401).json({error:auth.error||"Unauthorized"});
    const rows=await db("dankudo_accounts?user_id=eq."+encodeURIComponent(auth.user.id)+"&select=username&limit=1");
    return res.status(200).json({id:auth.user.id,email:auth.user.email||"",username:rows?.[0]?.username||auth.user.user_metadata?.username||"user",role:auth.role});
  }catch(error){console.error("Auth verification error:",error);return res.status(503).json({error:"Tidak dapat memverifikasi sesi saat ini."});}
}
