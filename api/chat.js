import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { verifySupabaseRequest } from "../lib/auth.js";

const docsPath = path.join(process.cwd(), "knowledge", "LUCIFER DOCS.txt");
let docsCache = "";
const hits = new Map();

function getDocs() {
  if (!docsCache) docsCache = fs.readFileSync(docsPath, "utf8");
  return docsCache;
}
function relevantDocs(question, source) {
  const normalize = value => String(value || "").toLowerCase()
    .replace(/sutoe?/g,"auto")
    .replace(/blok/g,"block")
    .replace(/hancurin|hancurkan/g,"break")
    .replace(/bersihin|bersihkan/g,"clear")
    .replace(/[^a-z0-9_:\s.-]/g," ")
    .replace(/\s+/g," ").trim();
  const query = normalize(question);
  const tokens = [...new Set(query.match(/[a-z_][a-z0-9_]{2,}/g) || [])];
  const expanded = new Set(tokens);
  const add = (...values) => values.forEach(value => expanded.add(value));
  if (/(auto.?clear|clear world|break|hancur|bersih)/.test(query)) {
    add("autoclear","auto_clear","auto clear","auto_clear.enabled","keep_jammer","keep_lock","name_length","item_storage","seed_storage","bot:hit","getBot()");
  }
  if (/(script|scripting|lua|kode|code|bot|api)/.test(query)) {
    add("getBot()","bot","sleep(ms)","runThread","getWorld()");
  }
  if (/(move|jalan|gerak|path|warp)/.test(query)) add("moveTo","moveTile","findPath","getPath","warp");
  if (/(item|block|blok|seed|id)/.test(query)) add("getInfo","getInfos","foreground","tile.fg","tile.bg");
  const lines = source.split(/\r?\n/);
  const windows = [];
  const seen = new Set();
  for (let i=0;i<lines.length;i++) {
    const line = lines[i].toLowerCase();
    const score = [...expanded].reduce((n,term)=>n+(line.includes(term)?1:0),0);
    if (!score) continue;
    const from=Math.max(0,i-3),to=Math.min(lines.length,i+5);
    const key=from+":"+to;
    if(seen.has(key))continue;
    seen.add(key);
    windows.push({text:lines.slice(from,to).join("\n"),score});
  }
  windows.sort((a,b)=>b.score-a.score);
  let selected=windows.slice(0,14).map(x=>x.text).join("\n...\n").slice(0,18000);
  const autoClearIntent=/(auto.?clear|clear world|break|hancur|bersih)/.test(query);
  if(autoClearIntent){
    const moduleLine=lines.findIndex(line=>/\*\*AutoClear\*\*/i.test(line));
    if(moduleLine>=0){
      selected+="\n\n[RUJUKAN KHUSUS AUTO CLEAR]\n"+lines.slice(Math.max(0,moduleLine-2),Math.min(lines.length,moduleLine+4)).join("\n");
    }
    selected+="\n\n[INTERPRETASI API TERDOKUMENTASI]\nAutoClear tercantum sebagai automation module. Modul diakses melalui bot.auto_clear dan properti yang tercantum: enabled, name_length, keep_jammer, keep_lock, no_number, output_path, item_storage, seed_storage. Dokumentasi ini tidak merinci algoritma internal atau method start/stop khusus AutoClear. Jangan menyatakan AutoClear tidak ada. Jangan mengarang method tambahan. Berikan contoh aktivasi minimal memakai getBot(), validasi bot, validasi world, lalu bot.auto_clear.enabled = true; jelaskan bahwa pengaturan opsional mengikuti kebutuhan dan detail perilaku modul perlu dikonfirmasi pada versi Lucifer yang dipakai.";
  }
  return selected;
}
let growtopiaItemCache = { fetchedAt: 0, entries: [] };
async function searchGrowtopiaItems(question) {
  const stopWords = new Set(["berapa","apa","id","item","items","block","blok","di","dalam","growtopia","gt","the","is","for","of","nama","itemnya","nya","dong","tolong","cari"]);
  const normalize = value => String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const queryTokens = [...new Set(normalize(question).split(" ").filter(token => token.length > 1 && !stopWords.has(token)))];
  if (!queryTokens.length || !/\b(id|item|block|blok|pepper|tree|seed)\b/i.test(question)) return "";
  try {
    if (!growtopiaItemCache.entries.length || Date.now() - growtopiaItemCache.fetchedAt > 30 * 60 * 1000) {
      const sources = [
        "https://raw.githubusercontent.com/zephilion/growtopia-item-id/main/click-here",
        "https://cdn.jsdelivr.net/gh/zephilion/growtopia-item-id@main/click-here"
      ];
      let body = "";
      let lastError;
      for (const url of sources) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "DanKudoAI/1.0" } });
          if (!response.ok) throw new Error("HTTP " + response.status);
          body = await response.text();
          if (!body.includes(":")) throw new Error("Unexpected item database format");
          break;
        } catch (error) { lastError = error; }
      }
      if (!body) throw lastError || new Error("All item database sources failed");
      const entries = [];
      for (const line of body.split(/\r?\n/)) {
        const match = line.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
        if (match) entries.push({ id: Number(match[1]), name: match[2].trim() });
      }
      if (!entries.length) throw new Error("No item records parsed");
      growtopiaItemCache = { fetchedAt: Date.now(), entries };
      console.info("Growtopia item database loaded:", entries.length, "records");
    }
    const scored = growtopiaItemCache.entries.map(item => {
      const nameTokens = normalize(item.name).split(" ");
      const matched = queryTokens.filter(token => nameTokens.includes(token));
      const allTokens = queryTokens.every(token => nameTokens.includes(token));
      const phraseMatch = nameTokens.join(" ") === queryTokens.join(" ") || normalize(item.name).includes(queryTokens.join(" "));
      return { ...item, matched: matched.length, score: matched.length / queryTokens.length, allTokens, phraseMatch };
    }).filter(item => item.matched > 0).sort((a,b) => Number(b.allTokens)-Number(a.allTokens) || Number(b.phraseMatch)-Number(a.phraseMatch) || b.score-a.score || b.matched-a.matched);
    if (!scored.length) return "";
    const best = scored[0];
    const matches = scored.filter(item => item.score === best.score && item.allTokens === best.allTokens).slice(0, 6);
    console.info("Growtopia item lookup:", question, "=>", matches.map(x => x.name + ":" + x.id).join(", "));
    return "HASIL LOOKUP DATABASE ITEM GROWTOPIA (sumber komunitas):\n" +
      matches.map(item => "- " + item.name + " — ID " + item.id).join("\n") +
      "\nSumber: https://github.com/zephilion/growtopia-item-id/blob/main/click-here\n" +
      "INSTRUKSI WAJIB: Ini adalah hasil pencarian data yang sudah berhasil diambil backend, bukan ingatan model. Jawab langsung memakai ID yang cocok. Jika nama yang ditanyakan menyebut 'Block' tetapi database mencatat nama item tanpa kata 'Block' (misalnya Pepper Tree), jelaskan nama database persisnya. Jangan mengatakan tidak punya akses web atau database ketika hasil ini tersedia. Jangan mengubah ID.";
  } catch (error) {
    console.warn("Growtopia item lookup failed:", error?.message || error);
    return "Pencarian database item Growtopia sedang gagal di sisi server. Jangan mengaku sudah melakukan web search; jelaskan bahwa lookup sedang tidak tersedia.";
  }
}
async function searchGrowtopiaWeb(question) {
  const technicalIntent = /(script|scripting|lua|api|bot|auto.?clear|suto|clear world|hancur|break|farm|pathfinding|mekanik|mechanic|event|acara|bulan ini|minggu ini|hari ini|sekarang|terbaru|latest|update|patch|maintenance|harga|price|wiki|forum|item|block|blok|seed|world lock|announcement|pengumuman)/i.test(question);
  if (!technicalIntent) return {context:"",sources:[],steps:[]};
  const normalizedQuestion = String(question).replace(/sutoe?/gi,"auto").replace(/blok/gi,"block");
  const now = new Date();
  const monthYear = new Intl.DateTimeFormat("en-US", {month:"long",year:"numeric",timeZone:"Asia/Jakarta"}).format(now);
  const query = "Growtopia Lucifer scripting API " + normalizedQuestion + " " + monthYear;
  const decode = value => String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  const results = [], steps = [{label:"Menyiapkan pencarian web",detail:query}];
  try {
    const rss=await fetch("https://www.bing.com/search?format=rss&q="+encodeURIComponent(query),{headers:{"User-Agent":"Mozilla/5.0 DanKudoAI/1.0"},signal:AbortSignal.timeout(10000)});
    if(!rss.ok)throw new Error("Bing RSS HTTP "+rss.status);
    const xml=await rss.text();
    for(const item of xml.match(/<item>[\s\S]*?<\/item>/gi)||[]){
      const title=decode(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),url=decode(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]),snippet=decode(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1]);
      if(title&&/^https?:\/\//i.test(url)&&!results.some(x=>x.url===url))results.push({title,url,snippet});
      if(results.length>=7)break;
    }
  }catch(error){console.warn("Bing Growtopia search failed:",error?.message||error)}
  if(!results.length){
    try{
      const response=await fetch("https://html.duckduckgo.com/html/?q="+encodeURIComponent(query),{headers:{"User-Agent":"Mozilla/5.0 (compatible; DanKudoAI/1.0)"},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error("DuckDuckGo HTTP "+response.status);
      const html=await response.text();
      const anchors=[...html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      for(const match of anchors.slice(0,7)){let url=decode(match[1]);try{const parsed=new URL(url);url=parsed.searchParams.get("uddg")||url}catch{}const title=decode(match[2]);if(/^https?:\/\//i.test(url)&&title&&!results.some(x=>x.url===url))results.push({title,url,snippet:""})}
      const snippets=[...html.matchAll(/<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
      snippets.forEach((match,index)=>{if(results[index])results[index].snippet=decode(match[1])});
    }catch(error){console.warn("DuckDuckGo Growtopia search failed:",error?.message||error)}
  }
  if(!results.length)return {context:"PENCARIAN WEB GROWTOPIA: pencarian dijalankan, tetapi mesin pencari tidak mengembalikan hasil. Jangan mengaku telah memverifikasi fakta terkini.",sources:[],steps:[...steps,{label:"Pencarian belum menemukan hasil",detail:"Mesin pencari tidak mengembalikan halaman."}]};
  console.info("Growtopia web search:",query,"=>",results.length,"results");
  steps.push({label:"Menemukan "+results.length+" halaman web",detail:"Hasil pencarian dari Bing atau DuckDuckGo."});
  const pages=await Promise.all(results.slice(0,4).map(async source=>{
    try{
      const response=await fetch(source.url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; DanKudoAI/1.0)"},signal:AbortSignal.timeout(4500)});
      if(!response.ok)return source;
      const html=await response.text();
      const pageText=decode(html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," "));
      return {...source,snippet:(pageText||source.snippet).slice(0,1800)};
    }catch{return source}
  }));
  const readCount=pages.filter((page,index)=>page.snippet&&page.snippet!==results[index].snippet).length;
  if(readCount)steps.push({label:"Membaca "+readCount+" halaman sumber",detail:"Mengambil isi halaman untuk memeriksa konteks."});
  return {
    context:"HASIL LIVE WEB SEARCH GROWTOPIA (query: "+query+"):\n"+pages.map((item,index)=>(index+1)+". "+item.title+"\nURL: "+item.url+"\nIsi/cuplikannya: "+(item.snippet||"(tidak ada cuplikan)")).join("\n\n")+"\nInstruksi: Gunakan hasil pencarian ini untuk menjawab. Prioritaskan pengumuman resmi Growtopia dan forum resmi untuk event/update. Perhatikan tanggal hasil; jangan menyimpulkan event masih aktif hanya dari halaman lama. Jangan menambahkan daftar URL sumber ke teks jawaban; sumber akan ditampilkan terpisah oleh aplikasi. Jangan mengatakan tidak punya akses web search jika hasil di atas tersedia.",
    sources:pages.map(item=>({title:item.title,url:item.url,snippet:item.snippet||""})),steps
  };
}
function rateLimit(ip) {
  const now = Date.now();
  const old = hits.get(ip);
  if (!old || now - old.start > 60_000) { hits.set(ip, {start:now,count:1}); return true; }
  if (old.count >= 8) return false;
  old.count++;
  return true;
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function redactSecrets(value) {
  return String(value)
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]{12,}/gi, "$1[REDACTED]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|sk-or-v1-[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{10,})\b/g, "[REDACTED]")
    .replace(/((?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?)[^\s"',;]{8,}/gi, "$1[REDACTED]");
}
function fallbackTitle(message) {
  const text = String(message || "").replace(/```[\s\S]*?```/g, " kode ").replace(/\s+/g, " ").trim();
  if (/^(hi|hai|halo|hello|hey|yo|p)[.!?,… ]*$/i.test(text)) return "Sapaan";
  const first = text.split(/[.!?\n]/)[0].trim();
  const cleaned = first.replace(/^(tolong|bisa|coba|please|can you|could you)\s+/i, "");
  return (cleaned || text).slice(0, 42).trim() || "Chat baru";
}
async function generateTitle(message, base, key, model) {
  try {
    const response = await fetch(base + "/chat/completions", {
      method:"POST",
      headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      signal:AbortSignal.timeout(9000),
      body:JSON.stringify({
        model,
        max_tokens:32,
        thinking:{type:"disabled"},
        messages:[
          {role:"system",content:"Buat judul percakapan dalam bahasa Indonesia berdasarkan PESAN PERTAMA pengguna. Judul harus merangkum inti maksud, bukan menyalin kalimat panjang. Maksimal 2-5 kata, singkat dan spesifik. Jika hanya sapaan, gunakan 'Sapaan'. Jika pengguna meminta analisis script/kode, gunakan 'Analisis Script' atau judul spesifik sesuai konteks. Jangan pakai tanda kutip, markdown, atau penjelasan. Output hanya judul."},
          {role:"user",content:String(message).slice(0,5000)}
        ]
      })
    });
    if (!response.ok) return fallbackTitle(message);
    const data = await response.json();
    const title = data?.choices?.[0]?.message?.content?.trim().replace(/^["'`]+|["'`]+$/g,"").replace(/[\r\n]+/g," ").slice(0,60);
    return title || fallbackTitle(message);
  } catch { return fallbackTitle(message); }
}
async function saveConversation({visitorId,conversationId,message,answer,usage,model,title}) {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret || !uuidPattern.test(visitorId) || !uuidPattern.test(conversationId)) return;
  const base = url.replace(/\/$/,"") + "/rest/v1/";
  const headers = {
    apikey: secret,
    ...(secret.startsWith("sb_secret_") ? {} : {Authorization: "Bearer " + secret}),
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal"
  };
  async function write(table, body, extra="") {
    const r = await fetch(base + table + extra, {method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
    if (!r.ok) throw new Error("Supabase write failed: " + r.status + " " + (await r.text()).slice(0,300));
  }
  const now = new Date().toISOString();
  await write("lucifer_visitors?on_conflict=visitor_id", [{visitor_id:visitorId,last_seen:now}]);
  await write("lucifer_conversations?on_conflict=id", [{id:conversationId,visitor_id:visitorId,title:redactSecrets(title || message).slice(0,100),updated_at:now}]);
  const promptTokens = Number.isInteger(usage?.prompt_tokens) ? usage.prompt_tokens : null;
  const completionTokens = Number.isInteger(usage?.completion_tokens) ? usage.completion_tokens : null;
  const userMessage={conversation_id:conversationId,role:"user",content:redactSecrets(message),model,prompt_tokens:promptTokens,completion_tokens:null};
  const assistantMessage={conversation_id:conversationId,role:"assistant",content:redactSecrets(answer),model,prompt_tokens:promptTokens,completion_tokens:completionTokens};
  await write("lucifer_messages", [userMessage]);
  await write("lucifer_messages", [assistantMessage]);
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const workerSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const workerKey = req.headers["x-dankudo-worker-key"] || "";
  const isInternalWorker = Boolean(workerSecret && workerKey && workerKey === workerSecret);
  let auth;
  if (isInternalWorker) {
    auth = { user: { id: req.body?.userId }, role: "user" };
  } else {
    try { auth = await verifySupabaseRequest(req); } catch (error) { console.error("Auth verification error:", error); return res.status(503).json({error:"Tidak dapat memverifikasi sesi saat ini."}); }
  }
  if (!auth.user?.id) return res.status(auth.status || 401).json({error:auth.error || "Silakan login untuk menggunakan DanKudo AI."});
  const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (!isInternalWorker && !rateLimit(ip)) return res.status(429).json({error:"Terlalu banyak permintaan. Coba lagi satu menit."});
  const key = process.env.VIKEY_API_KEY;
  if (!key) return res.status(500).json({error:"API key belum diatur di Vercel Environment Variables."});
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0,5) : [];
  const attachments = rawAttachments.map(file => ({
    path: typeof file?.path === "string" ? file.path.slice(0,500) : "",
    name: typeof file?.name === "string" ? file.name.slice(0,100) : "Lampiran",
    mimeType: typeof file?.mimeType === "string" ? file.mimeType.slice(0,100) : "",
    size: Number.isFinite(file?.size) ? Math.min(file.size, 3*1024*1024) : 0,
    textContent: typeof file?.textContent === "string" ? file.textContent.slice(0,50000) : "",
    signedUrl: isInternalWorker && typeof file?.signedUrl === "string" ? file.signedUrl.slice(0,2000) : ""
  })).filter(file => file.path || file.signedUrl || file.textContent);
  if (!message && !attachments.length) return res.status(400).json({error:"Pesan atau lampiran harus diisi."});
  const loggedMessage = message || ("Lampiran: " + attachments.map(file => file.name).join(", "));
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6).filter(x => ["user","assistant"].includes(x?.role) && typeof x?.content === "string").map(x => ({role:x.role,content:x.content.slice(0,1500)})) : [];
  if (!isInternalWorker) {
    const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId : "";
    if (!uuidPattern.test(conversationId)) return res.status(400).json({error:"ID percakapan tidak valid."});
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecret = workerSecret;
    if (!supabaseUrl || !supabaseSecret) return res.status(503).json({error:"Penyimpanan pekerjaan belum dikonfigurasi."});
    const jobId = uuidPattern.test(req.body?.jobId || "") ? req.body.jobId : crypto.randomUUID();
    if (attachments.some(file => file.path && !file.path.startsWith(auth.user.id + "/" + conversationId + "/")) ) return res.status(403).json({error:"Lampiran tidak sesuai dengan akun atau percakapan."});
    const job = {
      id: jobId,
      user_id: auth.user.id,
      conversation_id: conversationId,
      message: redactSecrets(message),
      attachments,
      history,
      is_first_message: req.body?.isFirstMessage === true,
      chat_title: typeof req.body?.chatTitle === "string" ? req.body.chatTitle.slice(0,100) : null,
      status: "queued"
    };
    const dbHeaders = {
      apikey: supabaseSecret,
      ...(supabaseSecret.startsWith("sb_secret_") ? {} : {Authorization:"Bearer " + supabaseSecret}),
      "Content-Type":"application/json",
      Prefer:"return=minimal"
    };
    try {
      const saved = await fetch((supabaseUrl.endsWith("/") ? supabaseUrl.slice(0,-1) : supabaseUrl) + "/rest/v1/dankudo_ai_jobs", {
        method:"POST", headers:dbHeaders, body:JSON.stringify(job), signal:AbortSignal.timeout(7000)
      });
      if (!saved.ok) throw new Error("Gagal menyimpan pekerjaan: " + saved.status);
      const queueSdk = await import("@vercel/queue");
      if (typeof queueSdk.send !== "function") throw new Error("Queue SDK send export is unavailable");
      await queueSdk.send("dankudo-ai-chat", {jobId}, {idempotencyKey:jobId, retentionSeconds:604800});
      return res.status(202).json({jobId,status:"queued"});
    } catch (error) {
      await fetch((supabaseUrl.endsWith("/") ? supabaseUrl.slice(0,-1) : supabaseUrl) + "/rest/v1/dankudo_ai_jobs?id=eq." + jobId, {
        method:"PATCH", headers:{...dbHeaders,Prefer:"return=minimal"}, body:JSON.stringify({status:"failed",error:"Tidak dapat memasukkan pekerjaan ke antrean.",updated_at:new Date().toISOString()})
      }).catch(()=>{});
      console.error("Background enqueue error:",error?.message || error);
      return res.status(503).json({error:"DanKudo AI belum bisa memasukkan pesan ke antrean. Coba kirim ulang."});
    }
  }
  try {
    // Fast-path for standalone greetings: avoid a model round-trip for trivial social messages.
    const simpleGreeting = message.toLowerCase().replace(/[.!?,…]+$/g, "").trim();
    const greetingReplies = {
      "hi": "Yo! Ada yang bisa gw bantu?",
      "hai": "Hai juga! Ada apa nih?",
      "halo": "Halo! Mau ngobrol atau ada yang mau dibantu?",
      "hello": "Hello! Ada yang bisa gw bantu?",
      "hey": "Hey! Gas, ada apa?",
      "yo": "Yo! Ada apa nih?",
      "p": "P juga wkwk. Ada apa?",
      "apa kabar": "Baik, aman. Lu sendiri gimana?",
      "apa kabar?": "Baik, aman. Lu sendiri gimana?"
    };
    if (!attachments.length && Object.prototype.hasOwnProperty.call(greetingReplies, simpleGreeting)) {
      const reply = greetingReplies[simpleGreeting];
      const visitorId = auth.user.id;
      const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId : "";
      const model = process.env.VIKEY_MODEL || "deepseek/deepseek-v4-pro";
      if (visitorId && conversationId) {
        try {
          await saveConversation({visitorId,conversationId,message,answer:reply,usage:null,model,title:"Sapaan"});
        } catch (logError) {
          console.error("Dashboard logging error:",logError?.message || logError);
        }
      }
      return res.status(200).json({reply,title:"Sapaan"});
    }
    const source = getDocs();
    const context = relevantDocs(message, source);
    const itemLookupContext = await searchGrowtopiaItems(message);
    const webSearchResult = await searchGrowtopiaWeb(message);
    const webSearchContext = webSearchResult.context;
    const base = (process.env.VIKEY_BASE_URL || "https://api.vikey.ai/v1").replace(/\/$/,"");
    const model = process.env.VIKEY_MODEL || "deepseek/deepseek-v4-pro";
    const systemPrompt = "Kamu adalah DanKudo AI, asisten ahli Growtopia dan scripting Lua untuk framework Lucifer. Tugasmu menyelesaikan masalah pengguna secara praktis, akurat, dan tuntas.\n\nPRIORITAS KERJA:\n1. Pahami tujuan akhir pengguna, bukan hanya kata-kata literalnya.\n2. Periksa dokumentasi Lucifer yang disediakan sebelum menyimpulkan API tidak ada.\n3. Gunakan pencarian item/database dan hasil web yang tersedia untuk mengisi fakta yang tidak ada di dokumentasi lokal.\n4. Berikan solusi paling langsung yang didukung bukti. Jangan berhenti pada daftar alasan atau meminta pengguna melakukan riset sendiri jika kamu masih bisa mencari.\n5. Untuk permintaan script, hasil utama harus berupa kode Lua lengkap yang siap dicoba, diikuti cara kerja, konfigurasi yang perlu diubah, dan batasan yang benar-benar relevan.\n6. Tanyakan klarifikasi hanya jika satu detail mutlak diperlukan untuk menghindari solusi yang salah atau berisiko.\n\nSUMBER KEBENARAN:\n- Dokumentasi Lucifer lokal adalah acuan utama untuk nama API, parameter, properti, event, return value, dan perilaku runtime.\n- Hasil database item dan web adalah sumber tambahan. Bedakan dokumentasi resmi, sumber komunitas, inferensi, dan hal yang belum terverifikasi.\n- Jangan pernah menyebut API tidak ada sebelum memeriksa seluruh konteks dokumentasi relevan.\n- PENTING: dokumentasi mencantumkan automation module AutoClear dengan properti enabled, name_length, keep_jammer, keep_lock, no_number, output_path, item_storage, seed_storage. Modul diakses melalui bot.auto_clear. Jadi jangan pernah menjawab AutoClear tidak terdokumentasi atau meminta pengguna menyediakan API dasar itu lagi. Pola aktivasi yang didukung dokumentasi adalah bot.auto_clear.enabled = true setelah memvalidasi bot dan world. Dokumentasi ringkas ini tidak menjelaskan detail algoritma internal atau seluruh arti konfigurasi; jangan mengarang method atau opsi tambahan.\n- API bot:hit(x,y), bot:moveTile(x,y), bot:findPath(x,y), bot:getWorld(), world:getTile(x,y), tile.fg/bg, getInfo(id), dan sleep(ms) tercantum di dokumentasi. Gunakan hanya bila relevan dan jangan mengarang return value.\n- tile:canHarvest() hanya memeriksa kesiapan panen, bukan breakability.\n- Jangan mengarang isBreakable(), canBreak(), enum, ID item, event, atau method yang tidak didukung bukti.\n- Jika fitur bawaan sudah tersedia (misalnya AutoClear, AutoFarm, AutoHarvest), prioritaskan modul tersebut daripada menulis ulang otomasi manual.\n- Untuk API yang memang tidak ditemukan, jelaskan bagian yang belum diketahui secara spesifik, lalu berikan alternatif terbaik yang masih bisa dibuat.\n\nCARA MENANGANI PERMINTAAN CODING:\n- Kenali bahasa dan runtime. Lucifer memakai Lua 5.x dengan indeks array mulai 1.\n- Tulis kode yang konsisten dengan dokumentasi, bukan pseudo-code yang tampak seperti kode siap jalan.\n- Sertakan validasi bot, status world, input, dan kondisi berhenti yang sesuai.\n- Hindari loop tanpa batas, aksi spam, dan asumsi bahwa aksi fire-and-forget berarti sukses.\n- Jangan meminta pengguna memberi daftar API yang sudah ada di dokumentasi.\n- Jangan meminta daftar ID block unbreakable jika solusi memakai modul AutoClear bawaan dan daftar itu tidak diperlukan.\n- Jika aksi bersifat destruktif seperti mengosongkan world, beri batasan singkat: jalankan hanya pada world milik pengguna atau yang pengguna punya izin kelola.\n- Jangan mengaku sudah menjalankan atau menguji kode di runtime Lucifer. Berikan langkah uji yang konkret.\n\nSTRATEGI RISET:\n- Untuk ID item, nama item, event terbaru, update, mekanik, API yang tidak jelas, atau contoh scripting Lucifer, gunakan hasil pencarian web/backend jika tersedia.\n- Normalisasi typo umum secara wajar (misalnya \"suto\" berarti \"auto\") tanpa mengubah maksud.\n- Prioritaskan sumber resmi, dokumentasi, database item, lalu wiki/forum/komunitas. Baca isi halaman yang tersedia, cek tanggal dan versi, bandingkan sumber jika klaim penting.\n- Jangan mencampur API Growtopia umum, API bot lain, dan API Lucifer. Contoh dari framework lain bukan bukti API itu ada di Lucifer.\n- Jika pencarian gagal, katakan pencarian gagal. Jangan berpura-pura sudah mencari atau mengutip sumber.\n- Sumber web ditampilkan oleh UI secara terpisah; jangan menempelkan daftar URL ke jawaban.\n\nPOLA JAWABAN:\n- Coding: solusi/kode dulu, lalu penjelasan singkat, konfigurasi, dan batasan.\n- Debugging: identifikasi penyebab paling mungkin, minta log hanya jika dibutuhkan, berikan patch konkret.\n- Pertanyaan fakta: jawab langsung, sertakan tingkat kepastian dan sumber jika tersedia.\n- Jika koreksi pengguna membuktikan jawaban sebelumnya salah, akui dan perbaiki tanpa defensif.\n- Jangan membanjiri jawaban dengan disclaimer, daftar kekurangan, atau pertanyaan yang tidak perlu.\n\nQUALITY CHECK SEBELUM MENJAWAB:\n- Apakah saya sudah mencari API di dokumentasi yang diberikan?\n- Apakah saya melewatkan module/function bawaan yang cocok?\n- Apakah semua nama API dan parameter dalam kode benar-benar didukung sumber?\n- Apakah saya sudah menjawab tujuan pengguna, bukan hanya menjelaskan kenapa sulit?\n- Apakah kode punya validasi dasar dan instruksi menjalankan?\nJangan tampilkan checklist atau chain-of-thought privat. Tampilkan hanya hasil, ringkasan alasan, dan batasan yang relevan.\n\nGAYA:\n- Bahasa Indonesia santai, natural, percaya diri tetapi tidak sok tahu.\n- Langsung ke inti. Jangan gunakan pembukaan panjang.\n- Untuk sapaan sederhana, balas singkat.\n- Jangan pernah mengarang kepastian demi terlihat pintar.";
    const chatMessages = [
      {role:"system",content:systemPrompt+"\n\nDOKUMENTASI RELEVAN:\n"+(context || "Tidak ada bagian dokumentasi yang cocok. Jawab pertanyaan Lua umum dan nyatakan bila detail Lucifer tidak ditemukan.")+(itemLookupContext ? "\n\n"+itemLookupContext : "")+(webSearchContext ? "\n\n"+webSearchContext : "")},
      ...history,
      {role:"user",content:attachments.length ? [
        {type:"text",text:message || "Tolong analisis lampiran berikut."},
        ...attachments.filter(file => file.textContent).map(file => ({type:"text",text:"\n\nIsi file "+file.name+":\n"+file.textContent})),
        ...attachments.filter(file => file.mimeType.startsWith("image/") && file.signedUrl).map(file => ({type:"image_url",image_url:{url:file.signedUrl}}))
      ] : message}
    ];
    const responsesInput = chatMessages.slice(1).map(item => {
      if (typeof item.content === "string") {
        return {role:item.role,content:[{type:"input_text",text:item.content}]};
      }
      const content = (Array.isArray(item.content) ? item.content : []).map(part => {
        if (part?.type === "text") return {type:"input_text",text:String(part.text || "")};
        if (part?.type === "image_url" && typeof part.image_url?.url === "string") return {type:"input_image",image_url:part.image_url.url};
        return null;
      }).filter(Boolean);
      return {role:item.role,content};
    });
    const response = await fetch(base + "/responses", {
      method:"POST",
      headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      signal:AbortSignal.timeout(45000),
      body:JSON.stringify({
        model,
        instructions:chatMessages[0].content,
        input:responsesInput,
        reasoning:{effort:"high"},
        max_output_tokens:5000,
        store:false
      })
    });
    const raw = await response.text();
    let data = {};
    try { data = JSON.parse(raw); } catch { data = {}; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.message || (raw && !raw.trimStart().startsWith("<") ? raw.slice(0,300) : "Provider AI gagal memproses permintaan.");
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({error:detail});
    }
    if (data?.status === "failed" || data?.error) {
      return res.status(502).json({error:data?.error?.message || "Model gagal menyelesaikan pencarian dan analisis. Coba kirim ulang."});
    }
    const outputItems = Array.isArray(data?.output) ? data.output : [];
    let answer = outputItems
      .filter(item => item?.type === "message" && item?.role === "assistant")
      .flatMap(item => Array.isArray(item.content) ? item.content : [])
      .filter(part => part?.type === "output_text" && typeof part.text === "string")
      .map(part => part.text)
      .join("\n")
      .trim();
    const webSources = [...(webSearchResult.sources || [])];
    const addSource = source => {
      const url = typeof source?.url === "string" ? source.url : "";
      if (!(url.startsWith("https://") || url.startsWith("http://"))) return;
      if (!webSources.some(item => item.url === url)) webSources.push({
        title:String(source?.title || source?.site_name || "Referensi web").slice(0,180),
        url
      });
    };
    for (const item of outputItems) {
      for (const source of (Array.isArray(item?.action?.sources) ? item.action.sources : [])) addSource(source);
      for (const annotation of (Array.isArray(item?.content) ? item.content : []).flatMap(part => Array.isArray(part?.annotations) ? part.annotations : [])) {
        addSource({url:annotation?.url,title:annotation?.title});
      }
    }
    if (!answer) {
      return res.status(502).json({error:"Model tidak mengembalikan jawaban teks. Coba kirim ulang."});
    }
    const isFirstMessage = req.body?.isFirstMessage === true;
    const title = isFirstMessage ? await generateTitle(loggedMessage, base, key, model) : (typeof req.body?.chatTitle === "string" ? req.body.chatTitle : fallbackTitle(message));
    const visitorId = auth.user.id;
    const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId : "";
    if (visitorId && conversationId) {
      try {
        await saveConversation({visitorId,conversationId,message:loggedMessage,answer,usage:{prompt_tokens:data?.usage?.input_tokens,completion_tokens:data?.usage?.output_tokens},model,title});
      } catch (logError) {
        console.error("Dashboard logging error:",logError?.message || logError);
      }
    }
    return res.status(200).json({reply:answer,title,sources:webSources.slice(0,8),searchSteps:webSearchResult.steps||[]});
  } catch (err) {
    console.error("Lucifer API error:",err);
    if (err?.name === "TimeoutError" || err?.name === "AbortError") return res.status(504).json({error:"Model terlalu lama merespons. Coba lagi atau kirim pertanyaan yang lebih singkat."});
    return res.status(500).json({error:"Terjadi kesalahan pada server Lucifer AI."});
  }
}
