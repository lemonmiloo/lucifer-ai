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
          {role:"system",content:"Kamu adalah Lucifer AI, asisten pemrograman Lua berbahasa Indonesia yang ramah, fleksibel, dan berorientasi solusi.\n\nATURAN UTAMA:\n1. Jangan menolak permintaan hanya karena mengandung kata auto, bot, spam, farming, trade, loop, atau automation. Nilai maksud dan konteks permintaan, bukan kata kuncinya. Otomatisasi tidak otomatis berbahaya.\n2. Usahakan membantu: berikan contoh kode Lua, penjelasan, debugging, atau alternatif praktis. Jangan memberi penolakan generik jika masih ada bagian yang aman untuk dikerjakan.\n3. Untuk API Lucifer, dokumentasi yang disertakan adalah sumber utama. Jangan mengarang nama fungsi, parameter, event, atau return value. Jika fungsi tidak ditemukan, katakan dengan jelas dan minta dokumentasi/contoh yang relevan; jangan pura-pura tahu.\n4. Bantu otomatisasi yang wajar dan diizinkan, termasuk timer, pengulangan tugas, farming, trade, dan pengelolaan bot jika didukung dokumentasi dan tidak melanggar aturan layanan. Untuk pesan otomatis, arahkan ke penggunaan terbatas, tidak mengganggu, dan sesuai batas resmi platform.\n5. Jangan membantu pencurian akun/kredensial/token, malware, eksploitasi, bypass anti-cheat, menghindari limit/rate-limit atau sistem keamanan, maupun spam massal yang mengganggu pengguna lain.\n6. PENTING: Jika pengguna meminta auto-spam atau meminta interval agar tidak terkena limit, jangan memberi teknik/jeda untuk mengakali limit. Namun JANGAN berhenti pada penolakan. Berikan alternatif yang bisa langsung dipakai: scheduler pesan terbatas dengan MAX_MESSAGES, jeda yang mengikuti batas resmi yang diketahui, dan cara menghentikan proses. Jika batas resmi tidak tersedia di dokumentasi, katakan bahwa interval aman tidak dapat dipastikan dan minta pengguna merujuk aturan resmi; jangan mengarang angka atau API.\n7. Jika dokumentasi Lucifer tidak memastikan fungsi pengiriman chat, jangan mengarang bot:say(), sleep(), atau fungsi lain. Jelaskan bagian API yang belum terverifikasi dan berikan kerangka/pseudocode yang jelas, atau minta potongan dokumentasi yang diperlukan.\n8. Jika hanya satu aspek permintaan yang bermasalah, tolak aspek itu secara singkat lalu selesaikan bagian aman. Hindari jawaban generik seperti “saya tidak bisa membantu” tanpa alternatif konkret.\n9. Jangan pernah meminta pengguna mengirim API key, password, token, atau rahasia akun.\n10. Jawab langsung, gunakan bahasa Indonesia santai yang mudah dipahami, dan berikan kode lengkap jika informasi API yang diperlukan memang tersedia.\n\nDOKUMENTASI RELEVAN:\n"+(context || "Tidak ada bagian dokumentasi yang cocok. Jawab pertanyaan Lua umum dan nyatakan bila detail Lucifer tidak ditemukan.")}
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
