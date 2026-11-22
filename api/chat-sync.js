import { verifySupabaseRequest } from "../lib/auth.js";

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function redact(value){
  return String(value||"")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]{12,}/gi,"$1[REDACTED]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|sk-or-v1-[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{10,})\b/g,"[REDACTED]")
    .replace(/((?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?)[^\s"',;]{8,}/gi,"$1[REDACTED]");
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    const auth=await verifySupabaseRequest(req);
    if(!auth.user)return res.status(auth.status||401).json({error:auth.error||"Unauthorized"});
    const conversations=Array.isArray(req.body?.conversations)?req.body.conversations.slice(0,150):[];
    const url=process.env.SUPABASE_URL;
    const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!secret)return res.status(503).json({error:"Konfigurasi database belum lengkap."});
    const base=url.replace(/\/$/,"")+"/rest/v1/";
    const headers={apikey:secret,...(secret.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+secret}),"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"};
    async function request(path,options={}){
      const response=await fetch(base+path,{...options,headers:{...headers,...(options.headers||{})},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error("Database sync gagal ("+response.status+"): "+(await response.text()).slice(0,220));
      return response.status===204?null:response.json().catch(()=>null);
    }
    const userId=auth.user.id;
    await request("lucifer_visitors?on_conflict=visitor_id",{method:"POST",body:JSON.stringify([{visitor_id:userId,last_seen:new Date().toISOString()}])});
    let importedConversations=0,importedMessages=0;
    for(const item of conversations){
      const id=String(item?.serverId||"");
      if(!uuidPattern.test(id))continue;
      const title=redact(item?.title||"Percakapan").slice(0,100)||"Percakapan";
      const messages=(Array.isArray(item?.messages)?item.messages:[])
        .filter(m=>["user","assistant"].includes(m?.role)&&typeof m?.content==="string"&&m.content.trim())
        .slice(0,300)
        .map(m=>({role:m.role,content:redact(m.content).slice(0,50000)}));
      if(!messages.length)continue;
      const ownership=await request("lucifer_conversations?id=eq."+encodeURIComponent(id)+"&select=visitor_id&limit=1",{method:"GET"});
      if(Array.isArray(ownership)&&ownership.length&&ownership[0].visitor_id!==userId)continue;
      await request("lucifer_conversations?on_conflict=id",{method:"POST",body:JSON.stringify([{id,visitor_id:userId,title,updated_at:new Date(Number(item.updatedAt)||Date.now()).toISOString()}])});
      const existing=await request("lucifer_messages?conversation_id=eq."+encodeURIComponent(id)+"&select=id&limit=1",{method:"GET"});
      if(Array.isArray(existing)&&existing.length)continue;
      await request("lucifer_messages",{method:"POST",body:JSON.stringify(messages.map(m=>({conversation_id:id,role:m.role,content:m.content,model:"local-history-import"})))});
      importedConversations++;
      importedMessages+=messages.length;
    }
    return res.status(200).json({ok:true,importedConversations,importedMessages});
  }catch(error){
    console.error("Chat history sync error:",error?.message||error);
    return res.status(502).json({error:"Gagal menyinkronkan riwayat chat lokal."});
  }
}
