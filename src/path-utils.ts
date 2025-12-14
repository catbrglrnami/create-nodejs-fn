import crypto from "node:crypto";
import path from "node:path";
import { ensureDir } from "./fs-utils";

export function hash8(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
}

export function sanitizeNamespace(relNoExt: string) {
  const noSrc = relNoExt.replace(/^src[/\\]/, "");
  const noSuffix = noSrc.replace(/\.container$/, "");
  return noSuffix.replace(/[/\\]/g, "_").replace(/[^A-Za-z0-9_]/g, "_");
}

export function proxyFilePath(gdirAbs: string, containerAbs: string) {
  const pDir = path.join(gdirAbs, "__proxies__");
  ensureDir(pDir);
  const h = hash8(containerAbs);
  return path.join(pDir, `p-${h}.ts`);
}
