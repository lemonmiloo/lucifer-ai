import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a,b) {
  const left=createHash("sha256").update(String(a)).digest();
  const right=createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(left,right);
}
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const password=process.env.OWNER_DASHBOARD_PASSWORD;
  if(!password) return res.status(503).json({error:"OWNER_DASHBOARD_PASSWORD belum diatur di Vercel."});
  let body=req.body;
  if(typeof body==="string") {
    try { body=JSON.parse(body); } catch { body={}; }
  }
  if(Buffer.isBuffer(body)) {
    try { body=JSON.parse(body.toString("utf8")); } catch { body={}; }
  }
  const submitted=body && typeof body==="object" ? body.password : "";
  if(typeof submitted!=="string" || !safeEqual(submitted,password)) return res.status(401).json({error:"Password salah."});
  const issued=String(Date.now());
  const signature=createHmac("sha256",password).update(issued).digest("base64url");
  res.setHeader("Set-Cookie",`lucifer_admin=${issued}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=43200`);
  return res.status(200).json({ok:true});
}
