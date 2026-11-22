import { verifySupabaseRequest } from "../../lib/auth.js";
import { db, URL, adminHeaders, passwordSignIn, normalizeUsername, validUsername } from "../../lib/account-auth.js";

async function updateAuthPassword(userId,password){
  const response=await fetch(URL.replace(/\/$/,"")+"/auth/v1/admin/users/"+encodeURIComponent(userId),{
    method:"PUT",headers:adminHeaders({"Content-Type":"application/json"}),
    body:JSON.stringify({password}),signal:AbortSignal.timeout(10000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.msg||data.message||"Password gagal diperbarui.");error.status=response.status;throw error}
  return data;
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    const auth=await verifySupabaseRequest(req);
    if(!auth.user)return res.status(auth.status||401).json({error:auth.error||"Unauthorized"});
    const action=String(req.body?.action||"");
    const currentPassword=String(req.body?.currentPassword||"");
    if(!currentPassword)return res.status(400).json({error:"Masukkan password saat ini untuk konfirmasi keamanan."});
    if(!auth.user.email)return res.status(400).json({error:"Email autentikasi akun tidak tersedia."});
    await passwordSignIn(auth.user.email,currentPassword);
    if(action==="username"){
      const username=normalizeUsername(req.body?.username);
      if(!validUsername(username))return res.status(400).json({error:"Username harus 3–20 karakter, hanya huruf, angka, dan underscore."});
      const rows=await db("dankudo_accounts?user_id=eq."+encodeURIComponent(auth.user.id),{
        method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=representation"},
        body:JSON.stringify({username})
      });
      if(!rows?.length)return res.status(404).json({error:"Data akun tidak ditemukan."});
      return res.status(200).json({ok:true,username:rows[0].username});
    }
    if(action==="password"){
      const newPassword=String(req.body?.newPassword||"");
      if(newPassword.length<8)return res.status(400).json({error:"Password baru minimal 8 karakter."});
      if(newPassword===currentPassword)return res.status(400).json({error:"Password baru harus berbeda dari password saat ini."});
      await updateAuthPassword(auth.user.id,newPassword);
      return res.status(200).json({ok:true});
    }
    return res.status(400).json({error:"Jenis perubahan profil tidak dikenal."});
  }catch(error){
    if(error.status===409||error.code==="23505")return res.status(409).json({error:"Username sudah dipakai akun lain."});
    if(/invalid login credentials|invalid email or password/i.test(error.message))return res.status(401).json({error:"Password saat ini salah."});
    console.error("Profile update failed:",error.message);
    return res.status(error.status===429?429:500).json({error:error.status===429?"Terlalu banyak percobaan. Coba lagi nanti.":"Perubahan profil gagal disimpan. Coba lagi."});
  }
}
