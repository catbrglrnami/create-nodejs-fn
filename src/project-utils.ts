import { ModuleKind, Project, QuoteKind, ScriptTarget, type SourceFile } from "ts-morph";

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
