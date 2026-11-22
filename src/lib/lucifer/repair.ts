import type { Violation } from "./validator.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { KNOWLEDGE } from "./knowledge.js";
import { FEWSHOT } from "./fewshot.js";

function cleanLua(text: string): string {
  return text.trim().replace(/^```(?:lua)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

export async function repair(
  src: string,
  violations: Violation[],
  apiKey: string,
  model: string,
  allowRaw = false
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: "GROUND TRUTH KNOWLEDGE (only valid Lucifer API source):\n" + KNOWLEDGE },
        { role: "system", content: "CANONICAL FEW-SHOT:\n" + FEWSHOT },
        { role: "system", content: "Repair mode. Do not introduce any API absent from the ground truth. Raw packet permission: " + (allowRaw ? "explicitly enabled by caller" : "disabled") + "." },
        { role: "user", content: `Perbaiki semua violation berikut dan keluarkan SATU file .lua penuh. Jangan menambahkan penjelasan atau markdown fence.\nVIOLATIONS:\n${JSON.stringify(violations)}\nSCRIPT SAAT INI:\n${src}` }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenAI repair failed: HTTP ${response.status}`);
  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Model repair tidak mengembalikan script.");
  return cleanLua(content);
}
