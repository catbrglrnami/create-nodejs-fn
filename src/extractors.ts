import { type Expression, type MethodDeclaration, Node, type SourceFile } from "ts-morph";
import type { DiscoveredExport } from "./types";

function methodToFunctionExprText(m: MethodDeclaration): string | undefined {
  const body = m.getBody();
  if (!body) return undefined;
  const asyncPrefix = m.isAsync() ? "async " : "";
  const params = m
    .getParameters()
    .map((p) => p.getText())
    .join(", ");
  return `${asyncPrefix}(${params}) => ${body.getText()}`;
}

function keyExprText(expr: Expression | undefined) {
  if (!expr) return undefined;
  if (
    Node.isArrowFunction(expr) ||
    Node.isFunctionExpression(expr) ||
    Node.isStringLiteral(expr) ||
    Node.isNoSubstitutionTemplateLiteral(expr)
  ) {
    return expr.getText();
  }
  return undefined;
}

function findTopLevelInitializer(sf: SourceFile, name: string) {
  for (const vs of sf.getVariableStatements()) {
    for (const decl of vs.getDeclarations()) {
      if (decl.getName() !== name) continue;
      return decl.getInitializer();
    }
  }
  return undefined;
}

function extractContainerKeyFromOptions(
  sf: SourceFile,
  exportName: string,
  optArg: Expression | undefined,
) {
  if (!optArg) return undefined;

  // containerKey(<single>)
  if (Node.isCallExpression(optArg)) {
    const callee = optArg.getExpression();
    const arg0 = optArg.getArguments()[0] as Expression | undefined;
    if (Node.isIdentifier(callee) && callee.getText() === "containerKey") {
      return keyExprText(arg0);
    }
  }

  // identifier -> resolve initializer recursively
  if (Node.isIdentifier(optArg)) {
    const init = findTopLevelInitializer(sf, optArg.getText());
    if (init) return extractContainerKeyFromOptions(sf, exportName, init as any);
  }

  if (!Node.isObjectLiteralExpression(optArg)) return undefined;
  const obj = optArg;

  const direct = obj.getProperty("containerKey");
  if (direct) {
    if (Node.isMethodDeclaration(direct)) return methodToFunctionExprText(direct) ?? undefined;
    if (Node.isPropertyAssignment(direct)) {
      const init = direct.getInitializer();
      if (
        init &&
        (Node.isArrowFunction(init) ||
          Node.isFunctionExpression(init) ||
          Node.isStringLiteral(init) ||
          Node.isNoSubstitutionTemplateLiteral(init))
      ) {
        return init.getText();
      }
    }
  }

  return undefined;
}

/**
 * Extract exported container entry points and any inline containerKey hints.
 */
export function extractExports(sf: SourceFile): DiscoveredExport[] {
  const out: DiscoveredExport[] = [];

  for (const vs of sf.getVariableStatements()) {
    if (!vs.isExported()) continue;
    for (const decl of vs.getDeclarations()) {
      const init = decl.getInitializer();
      const name = decl.getName();
      if (!init || !Node.isCallExpression(init)) continue;
      const callee = init.getExpression();
      if (!Node.isIdentifier(callee) || callee.getText() !== "nodejsFn") continue;

      const args = init.getArguments();
      const optArg = args[1] as Expression | undefined;
      const containerKeyExpr = extractContainerKeyFromOptions(sf, decl.getName(), optArg);

      out.push({ name, containerKeyExpr });
    }
  }

  for (const fn of sf.getFunctions()) {
    if (!fn.isExported()) continue;
    const hasTag = fn
      .getJsDocs()
      .some((d) => d.getTags().some((t) => t.getTagName() === "container"));
    if (hasTag) {
      const name = fn.getName();
      if (name) out.push({ name });
    }
  }

  return out;
}
