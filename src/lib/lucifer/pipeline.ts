import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { KNOWLEDGE } from "./knowledge.js";
import { FEWSHOT } from "./fewshot.js";
import { validate, type Violation } from "./validator.js";
import { repair } from "./repair.js";

function cleanLua(text: string): string {
  return text.trim().replace(/^```(?:lua)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

async function generate(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: "GROUND TRUTH KNOWLEDGE (only valid Lucifer API source):\n" + KNOWLEDGE },
        { role: "system", content: "CANONICAL FEW-SHOT:\n" + FEWSHOT },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenAI generation failed: HTTP ${response.status}`);
  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Model tidak mengembalikan script.");
  return cleanLua(content);
}

export async function runPipeline(prompt: string, allowRaw = false) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Generator belum dikonfigurasi: OPENAI_API_KEY tidak tersedia.");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  let script = await generate(prompt, apiKey, model);
  let violations: Violation[] = validate(script, { allowRaw });
  let iterations = 0;
  while (violations.length > 0 && iterations < 3) {
    iterations += 1;
    script = await repair(script, violations, apiKey, model, allowRaw);
    violations = validate(script, { allowRaw });
  }
  return {
    script,
    violations,
    iterations,
    ok: violations.length === 0,
    status: violations.length === 0 ? "validated" : "needs_manual_review"
  };
}
