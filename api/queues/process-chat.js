import { QueueClient } from "@vercel/queue";

const queue = new QueueClient();
const { handleNodeCallback } = queue;

function dbConfig() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Supabase worker configuration missing");
  return { base: url.replace(/\/$/, "") + "/rest/v1/", secret };
}
function headers(secret, extra = {}) {
  return {
    apikey: secret,
    ...(secret.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + secret }),
    "Content-Type": "application/json",
    ...extra
  };
}
async function getJob(jobId) {
  const {base,secret}=dbConfig();
  const r=await fetch(base+"dankudo_ai_jobs?id=eq."+encodeURIComponent(jobId)+"&select=*",{headers:headers(secret),signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error("Unable to load queued chat job: "+r.status);
  const rows=await r.json();
  return rows[0]||null;
}
async function updateJob(jobId, patch) {
  const {base,secret}=dbConfig();
  const r=await fetch(base+"dankudo_ai_jobs?id=eq."+encodeURIComponent(jobId),{
    method:"PATCH",headers:headers(secret,{Prefer:"return=minimal"}),
    body:JSON.stringify({...patch,updated_at:new Date().toISOString()}),
    signal:AbortSignal.timeout(8000)
  });
  if(!r.ok)throw new Error("Unable to update chat job: "+r.status);
}
export default handleNodeCallback(async (message, metadata) => {
  const jobId=message?.jobId;
  if(typeof jobId!=="string")return;
  const job=await getJob(jobId);
  if(!job || job.status==="completed" || job.status==="failed")return;
  await updateJob(jobId,{status:"processing",error:null});
  try {
    const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    const deployment=process.env.VERCEL_URL||"lucifer-ai-lemonmilo.vercel.app";
    const response=await fetch("https://"+deployment+"/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-dankudo-worker-key":secret},
      body:JSON.stringify({
        userId:job.user_id,
        message:job.message,
        history:job.history||[],
        conversationId:job.conversation_id,
        isFirstMessage:job.is_first_message===true,
        chatTitle:job.chat_title||""
      }),
      signal:AbortSignal.timeout(55000)
    });
    const raw=await response.text();
    let data={};
    try{data=JSON.parse(raw)}catch{}
    if(!response.ok || typeof data.reply!=="string") {
      const detail=data.error||"Model gagal memproses pesan.";
      throw new Error(detail);
    }
    await updateJob(jobId,{
      status:"completed",
      answer:data.reply,
      result_title:typeof data.title==="string"?data.title:null,
      error:null,
      completed_at:new Date().toISOString()
    });
  } catch(error) {
    if((metadata?.deliveryCount||1)>=5) {
      await updateJob(jobId,{status:"failed",error:"Proses AI gagal setelah beberapa percobaan. Silakan kirim ulang."});
      return;
    }
    await updateJob(jobId,{status:"queued",error:String(error?.message||"Worker error").slice(0,300)});
    throw error;
  }
});
