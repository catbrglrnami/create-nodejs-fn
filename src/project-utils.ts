import fs from "node:fs";
import path from "node:path";
import {
  ModuleKind,
  Project,
  QuoteKind,
  ScriptTarget,
  type SourceFile,
} from "ts-morph";

export function makeProject() {
  return new Project({
    useInMemoryFileSystem: false,
    manipulationSettings: { quoteKind: QuoteKind.Double, useTrailingCommas: true },
    compilerOptions: {
      target: ScriptTarget.ESNext,
      module: ModuleKind.ESNext,
      allowJs: true,
    },
  });
}

export function printSource(sf: SourceFile) {
  const text = sf.getFullText();
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function detectPkgManager(root: string) {
  const pnpm = fs.existsSync(path.join(root, "pnpm-lock.yaml"));
  const yarn = fs.existsSync(path.join(root, "yarn.lock"));
  const npm = fs.existsSync(path.join(root, "package-lock.json"));
  if (pnpm) return "pnpm";
  if (yarn) return "yarn";
  if (npm) return "npm";
  return "npm";
}
