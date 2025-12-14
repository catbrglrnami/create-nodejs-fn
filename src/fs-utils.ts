import fs from "node:fs";
import path from "node:path";

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function writeFileIfChanged(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (current === content) return;
  fs.writeFileSync(filePath, content);
}
