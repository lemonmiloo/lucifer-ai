const SUPABASE_URL=process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_hE2aLl_1yNzY5DDKXHt4Gw_MzruLP-_";

export async function verifySupabaseRequest(req){
  const authorization=req.headers.authorization||"";
  const token=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";
  if(!token||!SUPABASE_URL)return {error:"Unauthorized",status:401};
  const userResponse=await fetch(SUPABASE_URL.replace(/\/$/,"")+"/auth/v1/user",{
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+token},
    signal:AbortSignal.timeout(7000)
  });
  if(!userResponse.ok)return {error:"Sesi login tidak valid atau sudah kedaluwarsa.",status:401};
  const user=await userResponse.json();
  if(!user?.id)return {error:"Sesi login tidak valid.",status:401};
  const role=user.app_metadata?.role==="admin"?"admin":"user";
  return {user,role};
}
