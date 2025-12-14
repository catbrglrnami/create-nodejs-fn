import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import { VariableDeclarationKind } from "ts-morph";
import { ensureDir, writeFileIfChanged } from "./fs-utils";
import { makeProject, printSource } from "./project-utils";
import type { DiscoveredModule, DockerOptions } from "./types";

function collectExternalDeps(rootPkgPath: string, needed: string[]) {
  let pkgJson: any = { name: "create-nodejs-fn-container", version: "0.0.0" };
  if (fs.existsSync(rootPkgPath)) {
    try {
      pkgJson = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
    } catch {
      /* fall through with minimal package */
    }
  }

  const depsSources = [
    pkgJson.dependencies ?? {},
    pkgJson.optionalDependencies ?? {},
    pkgJson.devDependencies ?? {},
    pkgJson.peerDependencies ?? {},
  ];
  const out: Record<string, string> = {};
  for (const name of needed) {
    for (const src of depsSources) {
      if (src[name]) {
        out[name] = src[name];
        break;
      }
    }
  }
  return {
    name: pkgJson.name ?? "create-nodejs-fn-container",
    version: pkgJson.version ?? "0.0.0",
    dependencies: out,
  };
}

export type BuildContainerServerOptions = {
  mods: DiscoveredModule[];
  outBaseAbs: string;
  dockerOpts?: DockerOptions;
  containerPort: number;
  external: string[];
  root: string;
};

export async function buildContainerServer(opts: BuildContainerServerOptions) {
  const { mods, outBaseAbs, dockerOpts, containerPort, external, root } = opts;
  ensureDir(outBaseAbs);

  const entryTs = path.join(outBaseAbs, "container.entry.ts");
  const outServer = path.join(outBaseAbs, "server.mjs");
  const dockerfile = path.join(outBaseAbs, "Dockerfile");

  const genProject = makeProject();
  const sf = genProject.createSourceFile(entryTs, "", { overwrite: true });
  sf.addStatements(["// AUTO-GENERATED. DO NOT EDIT."]);
  sf.addImportDeclaration({ defaultImport: "http", moduleSpecifier: "node:http" });
  sf.addImportDeclaration({
    moduleSpecifier: "capnweb",
    namedImports: ["RpcTarget", "nodeHttpBatchRpcResponse"],
  });

  for (const mod of mods) {
    const relFromEntry = path
      .relative(path.dirname(entryTs), path.join(root, mod.fileRelFromRoot))
      .replace(/\\/g, "/")
      .replace(/\.tsx?$/, "");
    sf.addImportDeclaration({
      namespaceImport: `m_${mod.namespace}`,
      moduleSpecifier: relFromEntry,
    });
  }

  sf.addClass({
    name: "Api",
    extends: "RpcTarget",
    methods: mods.flatMap((mod) =>
      mod.exports.map((ex) => ({
        name: `${mod.namespace}__${ex.name}`,
        parameters: [{ name: "args", isRestParameter: true, type: "any[]" }],
        returnType: "any",
        statements: `return (m_${mod.namespace} as any)[${JSON.stringify(ex.name)}](...args);`,
      })),
    ),
  });

  sf.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name: "api", initializer: "new Api()" }],
  });

  sf.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: "server",
        initializer: `
http.createServer((req, res) => {
  const u = new URL(req.url ?? "/", "http://localhost");

  if (u.pathname === "/api") {
    nodeHttpBatchRpcResponse(req, res, api as any);
    return;
  }

  if (u.pathname === "/health") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
})
        `.trim(),
      },
    ],
  });

  sf.addStatements(
    `server.listen(${containerPort}, "0.0.0.0", () => console.log("create-nodejs-fn container listening on ${containerPort}"));`,
  );

  writeFileIfChanged(entryTs, printSource(sf));

  const pkgJson = collectExternalDeps(path.join(root, "package.json"), external);
  if (pkgJson) {
    writeFileIfChanged(
      path.join(outBaseAbs, "package.json"),
      `${JSON.stringify(pkgJson, null, 2)}\n`,
    );
  }

  const {
    baseImage = "node:20-slim",
    systemPackages = [],
    preInstallCommands = [],
    postInstallCommands = [],
    env: dockerEnv = {},
  } = dockerOpts ?? {};

  const installLines = "RUN corepack enable && pnpm install --prod --no-frozen-lockfile";

  const sysDeps =
    systemPackages.length > 0
      ? [
          "# System packages (from plugin options)",
          `RUN apt-get update && apt-get install -y --no-install-recommends ${systemPackages.join(" ")} \\`,
          "    && rm -rf /var/lib/apt/lists/*",
        ]
      : [];

  const preRuns = preInstallCommands.map((cmd) => `RUN ${cmd}`);
  const postRuns = postInstallCommands.map((cmd) => `RUN ${cmd}`);
  const envLines = [
    "ENV NODE_ENV=production",
    ...Object.entries(dockerEnv).map(([k, v]) => `ENV ${k}=${JSON.stringify(v ?? "")}`),
  ];

  writeFileIfChanged(
    dockerfile,
    [
      "# AUTO-GENERATED. DO NOT EDIT.",
      `FROM ${baseImage}`,
      "WORKDIR /app",
      ...sysDeps,
      ...preRuns,
      "# Install deps (only externals declared via plugin options)",
      "COPY package.json ./",
      installLines,
      "# Server bundle",
      "COPY ./server.mjs ./server.mjs",
      ...envLines,
      ...postRuns,
      `EXPOSE ${containerPort}`,
      `CMD ["node", "./server.mjs"]`,
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const buildOptions: esbuild.BuildOptions = {
    entryPoints: [entryTs],
    outfile: outServer,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    sourcemap: true,
    external,
  };

  await esbuild.build(buildOptions);
}
