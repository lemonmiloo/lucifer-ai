const SUPABASE_URL=process.env.SUPABASE_URL;
const SUPABASE_KEY=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function verifySupabaseRequest(req){
  const authorization=req.headers.authorization||"";
  const token=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";
  if(!token||!SUPABASE_URL||!SUPABASE_KEY)return {error:"Unauthorized",status:401};
  const headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+token};
  const userResponse=await fetch(SUPABASE_URL.replace(/\\/$/,"")+"/auth/v1/user",{headers,signal:AbortSignal.timeout(7000)});
  if(!userResponse.ok)return {error:"Sesi login tidak valid atau sudah kedaluwarsa.",status:401};
  const user=await userResponse.json();
  if(!user?.id)return {error:"Sesi login tidak valid.",status:401};
  const roleResponse=await fetch(SUPABASE_URL.replace(/\\/$/,"")+"/rest/v1/dankudo_user_roles?user_id=eq."+encodeURIComponent(user.id)+"&select=role",{headers,signal:AbortSignal.timeout(7000)});
  if(!roleResponse.ok)return {error:"Gagal memeriksa hak akses akun.",status:503};
  const roles=await roleResponse.json();
  return {user,role:roles?.[0]?.role==="admin"?"admin":"user"};
}
