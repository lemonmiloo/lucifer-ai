import { normalizeUsername,validUsername,getAccount,getDeviceId,bindDeviceAndLog,passwordSignIn } from "../../lib/account-auth.js";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    const username=normalizeUsername(req.body?.username),password=String(req.body?.password||""),deviceId=getDeviceId(req.body?.deviceId);
    if(!validUsername(username)||!password||!deviceId)return res.status(400).json({error:"Username, password, atau identitas perangkat tidak valid."});
    const account=await getAccount(username);
    if(!account)return res.status(401).json({error:"Username atau password salah."});
    const session=await passwordSignIn(account.auth_email,password);
    const bound=await bindDeviceAndLog({userId:account.user_id,username,deviceId,req});
    if(!bound.ok)return res.status(403).json({error:bound.error});
    return res.status(200).json({session});
  }catch(error){
    if(/invalid login credentials|invalid email or password/i.test(error.message))return res.status(401).json({error:"Username atau password salah."});
    console.error("Username login failed:",error.message);
    return res.status(error.status===429?429:500).json({error:error.status===429?"Terlalu banyak percobaan. Coba lagi nanti.":"Login gagal. Coba lagi sebentar."});
  }
}
