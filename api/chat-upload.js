import crypto from "node:crypto";
import { verifySupabaseRequest } from "../lib/auth.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowed = new Map([
  ["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"],["image/gif","gif"]
]);
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  let auth;
  try{auth=await verifySupabaseRequest(req)}catch{return res.status(503).json({error:"Sesi tidak dapat diverifikasi."})}
  if(!auth?.user?.id)return res.status(401).json({error:"Silakan login terlebih dahulu."});
  const {conversationId,fileName,mimeType,data}=req.body||{};
  if(!uuid.test(conversationId||""))return res.status(400).json({error:"ID percakapan tidak valid."});
  if(!allowed.has(mimeType)||typeof data!=="string"||data.length>4_200_000)return res.status(400).json({error:"Format atau ukuran file tidak didukung. Maksimal 3 MB per gambar."});
  const buffer=Buffer.from(data,"base64");
  if(!buffer.length||buffer.length>3*1024*1024)return res.status(413).json({error:"Ukuran gambar maksimal 3 MB."});
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase=process.env.SUPABASE_URL;
  if(!secret||!supabase)return res.status(503).json({error:"Penyimpanan file belum dikonfigurasi."});
  const safeName=String(fileName||"gambar").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80)||"gambar";
  const path=auth.user.id+"/"+conversationId+"/"+crypto.randomUUID()+"-"+safeName+"."+allowed.get(mimeType);
  const headers={apikey:secret,...(secret.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+secret}),"Content-Type":mimeType,"x-upsert":"false"};
  try{
    const root=supabase.replace(/\/$/,"");
    const r=await fetch(root+"/storage/v1/object/dankudo-chat-files/"+path.split("/").map(encodeURIComponent).join("/"),{method:"POST",headers,body:buffer,signal:AbortSignal.timeout(20000)});
    if(!r.ok){const detail=await r.text();console.error("Attachment storage error:",r.status,detail.slice(0,200));return res.status(502).json({error:"Gagal menyimpan lampiran. Coba unggah ulang."})}
    return res.status(200).json({path,name:safeName,mimeType,size:buffer.length});
  }catch(error){console.error("Attachment upload error:",error?.message||error);return res.status(502).json({error:"Koneksi upload terputus. Coba lagi."})}
}
