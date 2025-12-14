export type DockerOptions = {
  baseImage?: string;
  systemPackages?: string[];
  preInstallCommands?: string[];
  postInstallCommands?: string[];
  env?: Record<string, string>;
  extraLines?: string[];
};

export type Opts = {
  files?: string[];
  generatedDir?: string;

  binding?: string; // Durable Object binding name
  className?: string; // DO class name
  containerPort?: number;
  external?: string[];
  docker?: DockerOptions;
  /**
   * Worker env vars to forward into the container via Container.envVars.
   * Accepts an array of names (same name) or a map of containerName -> workerEnvKey.
   */
  workerEnvVars?: string[] | Record<string, string>;
  /**
   * Automatically rebuild containers in local dev when *.container.ts files change. default: true
   */
  autoRebuildContainers?: boolean;
  /**
   * Debounce duration in milliseconds for container rebuilds during dev. default: 200
   */
  rebuildDebounceMs?: number;
};

export type DiscoveredExport = { name: string; containerKeyExpr?: string };

export type DiscoveredModule = {
  fileAbs: string;
  fileRelFromRoot: string;
  namespace: string;
  exports: DiscoveredExport[];
};

export type RegenKind = "serve" | "build";
