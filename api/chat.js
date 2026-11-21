import fs from "node:fs";
import path from "node:path";

const docsPath = path.join(process.cwd(), "knowledge", "LUCIFER DOCS.txt");
let docsCache = "";
const hits = new Map();

function getDocs() {
  if (!docsCache) docsCache = fs.readFileSync(docsPath, "utf8");
  return docsCache;
}
function relevantDocs(question, source) {
  const terms = [...new Set((question.toLowerCase().match(/[a-z_][a-z0-9_]{2,}/g) || []))];
  const chunks = source.split(/\n(?=#{1,4} )/).filter(Boolean);
  return chunks.map((chunk) => {
    const lower = chunk.toLowerCase();
    return { chunk, score: terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0) };
  }).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0,5).map(x => x.chunk).join("\n\n---\n\n").slice(0,18000);
}
function rateLimit(ip) {
  const now = Date.now();
  const old = hits.get(ip);
  if (!old || now - old.start > 60_000) { hits.set(ip, {start:now,count:1}); return true; }
  if (old.count >= 8) return false;
  old.count++;
  return true;
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (!rateLimit(ip)) return res.status(429).json({error:"Terlalu banyak permintaan. Coba lagi satu menit."});
  const key = process.env.VIKEY_API_KEY;
  if (!key) return res.status(500).json({error:"API key belum diatur di Vercel Environment Variables."});
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({error:"Pesan tidak boleh kosong."});
  if (message.length > 6000) return res.status(413).json({error:"Pesan terlalu panjang (maksimal 6.000 karakter)."});
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8).filter(x => ["user","assistant"].includes(x?.role) && typeof x?.content === "string").map(x => ({role:x.role,content:x.content.slice(0,3000)})) : [];
  try {
    const source = getDocs();
    const context = relevantDocs(message, source);
    const base = (process.env.VIKEY_BASE_URL || "https://api.vikey.ai/v1").replace(/\/$/,"");
    const response = await fetch(base + "/chat/completions", {
      method:"POST",
      headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:process.env.VIKEY_MODEL || "deepseek/deepseek-v4-pro",
        max_tokens:1200,
        messages:[
          {role:"system",content:"Kamu adalah Lucifer AI, asisten pemrograman Lua berbahasa Indonesia. Gunakan dokumentasi Lucifer yang diberikan sebagai sumber utama; jangan mengarang nama API, parameter, atau return value. Jika dokumentasi tidak menjelaskan sesuatu, katakan dengan jujur. Bantu menjelaskan Lua, debugging, dan contoh kode yang aman. Jangan membantu pencurian akun/kredensial, pencurian token, spam, eksploitasi, bypass anti-cheat, atau menghindari sistem keamanan. Jangan pernah meminta atau menampilkan API key.\n\nDOKUMENTASI RELEVAN:\n"+(context || "Tidak ada bagian dokumentasi yang cocok. Jawab pertanyaan Lua umum dan nyatakan bila detail Lucifer tidak ditemukan." )}
          ,...history,
          {role:"user",content:message}
        ]
      })
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) return res.status(response.status).json({error:data?.error?.message || data?.message || "Provider AI gagal memproses permintaan."});
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string") return res.status(502).json({error:"Provider tidak mengembalikan jawaban yang valid."});
    return res.status(200).json({reply:answer});
  } catch (err) {
    console.error("Lucifer API error:",err);
    return res.status(500).json({error:"Terjadi kesalahan pada server Lucifer AI."});
  }
}
