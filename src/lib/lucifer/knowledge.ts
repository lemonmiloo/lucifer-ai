import fs from "node:fs";
import path from "node:path";
export const KNOWLEDGE = fs.readFileSync(path.join(process.cwd(), "knowledge", "LUCIFER_DOCS.lua"), "utf8");