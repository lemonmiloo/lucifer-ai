import { normalizeUsername,validUsername,getDeviceId,bindDeviceAndLog,passwordSignIn,URL,SECRET } from "../../lib/account-auth.js";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  let createdUserId=null;
  try{
    const username=normalizeUsername(req.body?.username),password=String(req.body?.password||""),deviceId=getDeviceId(req.body?.deviceId);
    if(!validUsername(username))return res.status(400).json({error:"Username harus 3–20 karakter: huruf, angka, atau underscore."});
    if(password.length<8)return res.status(400).json({error:"Password minimal 8 karakter."});
    if(!deviceId)return res.status(400).json({error:"Identitas perangkat tidak valid."});
    const base=URL.replace(/\/$/,"");
    const deviceResponse=await fetch(base+"/rest/v1/dankudo_device_accounts?device_id=eq."+encodeURIComponent(deviceId)+"&select=user_id&limit=1",{headers:{apikey:SECRET,Authorization:"Bearer "+SECRET},signal:AbortSignal.timeout(7000)});
    if(!deviceResponse.ok)throw new Error("Gagal memeriksa perangkat.");
    const deviceRows=await deviceResponse.json();
    if(deviceRows.length)return res.status(409).json({error:"HP ini sudah memiliki akun DanKudo AI. Satu perangkat hanya bisa membuat satu akun."});
    const email=username+"@accounts.dankudoai.invalid";
    const createResponse=await fetch(base+"/auth/v1/admin/users",{
      method:"POST",headers:{apikey:SECRET,Authorization:"Bearer "+SECRET,"Content-Type":"application/json"},
      body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username}}),signal:AbortSignal.timeout(10000)
    });
    const created=await createResponse.json().catch(()=>({}));
    if(!createResponse.ok){
      if(createResponse.status===422||/already|exists|registered/i.test(JSON.stringify(created)))return res.status(409).json({error:"Username sudah digunakan."});
      throw new Error("Gagal membuat akun auth: "+(created.message||created.msg||createResponse.status));
    }
    createdUserId=created.id;
    const profileResponse=await fetch(base+"/rest/v1/dankudo_accounts",{
      method:"POST",headers:{apikey:SECRET,Authorization:"Bearer "+SECRET,"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify({user_id:created.id,username,auth_email:email}),signal:AbortSignal.timeout(9000)
    });
    if(!profileResponse.ok)throw new Error("Username sudah digunakan atau profil gagal disimpan.");
    const bound=await bindDeviceAndLog({userId:created.id,username,deviceId,req});
    if(!bound.ok)throw new Error(bound.error);
    const session=await passwordSignIn(email,password);
    return res.status(201).json({session});
  }catch(error){
    if(createdUserId){
      try{await fetch(URL.replace(/\/$/,"")+"/auth/v1/admin/users/"+createdUserId,{method:"DELETE",headers:{apikey:SECRET,Authorization:"Bearer "+SECRET},signal:AbortSignal.timeout(7000)})}catch{}
    }
    console.error("Username registration failed:",error.message);
    return res.status(500).json({error:"Pendaftaran gagal. Periksa username atau coba lagi."});
  }
}
