import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runPipeline } from "../src/lib/lucifer/pipeline.js";

export const config = { maxDuration: 120 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body: any = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: "Body harus JSON valid." }); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Body harus berupa object JSON." });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "prompt wajib diisi." });
  if (prompt.length > 40000) return res.status(413).json({ error: "Prompt terlalu panjang (maksimal 40.000 karakter)." });

  // Raw packet permission requires both an explicit client opt-in and explicit wording in the request.
  const allowRaw = body.allowRaw === true && /raw packet|sendpacket|sendraw/i.test(prompt);
  try {
    const result = await runPipeline(prompt, allowRaw);
    return res.status(200).json(result);
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "";
    if (message.includes("OPENAI_API_KEY")) {
      return res.status(503).json({ error: "Generator belum dikonfigurasi oleh administrator." });
    }
    return res.status(502).json({ error: "Generator gagal memproses permintaan. Coba lagi nanti." });
  }
}
