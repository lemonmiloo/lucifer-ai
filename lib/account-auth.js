import { createHash } from "node:crypto";

const URL=process.env.SUPABASE_URL;
const SECRET=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY="sb_publishable_hE2aLl_1yNzY5DDKXHt4Gw_MzruLP-_";

export function normalizeUsername(value){
  return String(value||"").trim().toLowerCase();
}
export function validUsername(value){
  return /^[a-z0-9_]{3,20}$/.test(value);
}
function adminHeaders(extra={}){
  if(!URL||!SECRET)throw new Error("Konfigurasi database belum lengkap.");
  return {apikey:SECRET,Authorization:"Bearer "+SECRET,...extra};
}
export async function db(path,options={}){
  const response=await fetch(URL.replace(/\/$/,"")+"/rest/v1/"+path,{
    ...options,headers:adminHeaders(options.headers||{}),signal:AbortSignal.timeout(9000)
  });
  const raw=await response.text();
  let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!response.ok){const error=new Error(data?.message||data?.details||"Database request gagal.");error.status=response.status;throw error}
  return data;
}
export async function getAccount(username){
  const rows=await db("dankudo_accounts?username=eq."+encodeURIComponent(username)+"&select=user_id,username,auth_email&limit=1");
  return rows?.[0]||null;
}
export function getDeviceId(value){
  const id=String(value||"");
  return /^[a-f0-9-]{36}$/i.test(id)?id:null;
}
async function findDevice(deviceId){
  const rows=await db("dankudo_device_accounts?device_id=eq."+encodeURIComponent(deviceId)+"&select=device_id,user_id&limit=1");
  return rows?.[0]||null;
}
export async function bindDeviceAndLog({userId,username,deviceId,req}){
  let device=await findDevice(deviceId);
  if(device&&device.user_id!==userId)return {ok:false,error:"HP ini sudah terhubung ke akun lain. Satu perangkat hanya bisa memakai satu akun."};
  if(!device){
    try{
      await db("dankudo_device_accounts",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({device_id:deviceId,user_id:userId})});
    }catch(error){
      if(error.status!==409)throw error;
    }
    device=await findDevice(deviceId);
    if(!device||device.user_id!==userId)return {ok:false,error:"Perangkat ini sudah terdaftar pada akun lain."};
  }
  await db("dankudo_device_accounts?device_id=eq."+encodeURIComponent(deviceId)+"&user_id=eq."+encodeURIComponent(userId),{
    method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({last_seen:new Date().toISOString()})
  });
  const forwarded=String(req.headers["x-forwarded-for"]||"").split(",")[0].trim();
  const ipHash=forwarded?createHash("sha256").update(forwarded+"|"+SECRET).digest("hex"):null;
  const recent=await db("dankudo_login_events?user_id=eq."+encodeURIComponent(userId)+"&device_id=eq."+encodeURIComponent(deviceId)+"&select=logged_at&order=logged_at.desc&limit=1");
  const recentAt=recent?.[0]?.logged_at?new Date(recent[0].logged_at).getTime():0;
  if(Date.now()-recentAt>60000){
    await db("dankudo_login_events",{
      method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify({user_id:userId,username,device_id:deviceId,ip_hash:ipHash,user_agent:String(req.headers["user-agent"]||"").slice(0,400)||null})
    });
  }
  return {ok:true};
}
export async function passwordSignIn(authEmail,password){
  const response=await fetch(URL.replace(/\/$/,"")+"/auth/v1/token?grant_type=password",{
    method:"POST",headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email:authEmail,password}),signal:AbortSignal.timeout(10000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.msg||data.message||data.error_description||"Username atau password salah.");
  return data;
}
export {URL,SECRET,PUBLIC_KEY,adminHeaders};
