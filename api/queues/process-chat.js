import { QueueClient } from "@vercel/queue";

const queue = new QueueClient();

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
async function signedAttachment(file, userId, conversationId) {
  if (file?.textContent || !file?.mimeType?.startsWith("image/")) return file;
  const expected = userId + "/" + conversationId + "/";
  if (typeof file.path !== "string" || !file.path.startsWith(expected)) throw new Error("Invalid attachment ownership");
  const {secret}=dbConfig();
  const configuredUrl=process.env.SUPABASE_URL;
  const root=configuredUrl.endsWith("/")?configuredUrl.slice(0,-1):configuredUrl;
  const objectPath=file.path.split("/").map(encodeURIComponent).join("/");
  const response=await fetch(root+"/storage/v1/object/sign/dankudo-chat-files/"+objectPath,{
    method:"POST",headers:headers(secret),body:JSON.stringify({expiresIn:3600}),signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw new Error("Unable to create private attachment link");
  const data=await response.json();
  const signed=data.signedURL||data.signedUrl;
  if(typeof signed!=="string")throw new Error("Storage did not return a signed attachment URL");
  return {...file,signedUrl:signed.startsWith("http")?signed:root+(signed.startsWith("/")?signed:"/"+signed)};
}
export default queue.handleNodeCallback(async (message, metadata) => {
  const jobId=message?.jobId;
  if(typeof jobId!=="string")return;
  const job=await getJob(jobId);
  if(!job || job.status==="completed" || job.status==="failed")return;
  await updateJob(jobId,{status:"processing",error:null});
  const processingStartedAt=Date.now();
  try {
    const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    const deployment=process.env.VERCEL_URL||"lucifer-ai-lemonmilo.vercel.app";
    const attachments=await Promise.all((Array.isArray(job.attachments)?job.attachments:[]).map(file=>signedAttachment(file,job.user_id,job.conversation_id)));
    const response=await fetch("https://"+deployment+"/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-dankudo-worker-key":secret},
      body:JSON.stringify({
        userId:job.user_id,
        message:job.message,
        attachments,
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
      sources:Array.isArray(data.sources)?data.sources.slice(0,8):[],
      search_steps:Array.isArray(data.searchSteps)?data.searchSteps.slice(0,8):[],
      duration_ms:Math.max(0,Date.now()-processingStartedAt),
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
