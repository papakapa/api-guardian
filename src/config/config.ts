import * as fs from "node:fs";
import * as path from "node:path";

import type { ApiGuardianConfig, DiffMode, ParserTarget } from "../types/types";

export const DEFAULT_CONFIG_FILE = "api-guardian.config.json";

export const DEFAULT_CONFIG: ApiGuardianConfig = {
  version: 1,
  projectRoot: ".",
  parser: {
    target: "nest",
  },
  diff: {
    mode: "git",
    git: {
      base: "origin/main",
      head: "HEAD",
    },
    snapshot: {
      basePath: "",
      headPath: "",
    },
  },
  snapshot: {
    outputPath: ".api-guardian/contract.json",
  },
};

function cloneConfig(): ApiGuardianConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ApiGuardianConfig;
}

function assertParserTarget(v: unknown): ParserTarget {
  if (v === "nest") {
    return "nest";
  }
  throw new Error(
    `Unsupported parser.target "${String(v)}" in config. Only "nest" is implemented.`,
  );
}

export function findConfigFile(startDir: string): string | undefined {
  const abs = path.resolve(startDir);
  const primary = path.join(abs, DEFAULT_CONFIG_FILE);
  if (fs.existsSync(primary)) {
    return primary;
  }
  return undefined;
}

export function loadConfigFromPath(filePath: string): ApiGuardianConfig {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return mergeWithDefaults(parsed);
}

/** Start from defaults, overlay file contents (shallow for top-level; deep for known nested objects). */
function mergeWithDefaults(partial: unknown): ApiGuardianConfig {
  const base = cloneConfig();
  if (!partial || typeof partial !== "object") {
    return base;
  }
  const p = partial as Record<string, unknown>;

  if (typeof p.version === "number") {
    base.version = p.version;
  }

  if (typeof p.projectRoot === "string") {
    base.projectRoot = p.projectRoot;
  }

  if (p.parser && typeof p.parser === "object") {
    const pr = p.parser as Record<string, unknown>;
    if (pr.target !== undefined) {
      base.parser.target = assertParserTarget(pr.target);
    }
  }

  if (p.diff && typeof p.diff === "object") {
    const d = p.diff as Record<string, unknown>;
    if (d.mode === "git" || d.mode === "snapshot") {
      base.diff.mode = d.mode as DiffMode;
    }
    if (d.git && typeof d.git === "object") {
      const g = d.git as Record<string, unknown>;
      if (typeof g.base === "string") {
        base.diff.git.base = g.base;
      }
      if (typeof g.head === "string") {
        base.diff.git.head = g.head;
      }
    }
    if (d.snapshot && typeof d.snapshot === "object") {
      const s = d.snapshot as Record<string, unknown>;
      if (typeof s.basePath === "string") {
        base.diff.snapshot.basePath = s.basePath;
      }
      if (typeof s.headPath === "string") {
        base.diff.snapshot.headPath = s.headPath;
      }
    }
  }

  if (p.snapshot && typeof p.snapshot === "object") {
    const s = p.snapshot as Record<string, unknown>;
    if (typeof s.outputPath === "string") {
      base.snapshot.outputPath = s.outputPath;
    }
  }

  return base;
}

export type CliConfigOverrides = {
  configPath?: string;
  /** Resolved project directory (tsconfig root). */
  projectRoot?: string;
  parserTarget?: ParserTarget;
  diffMode?: DiffMode;
  gitBase?: string;
  gitHead?: string;
  snapshotBasePath?: string;
  snapshotHeadPath?: string;
  snapshotOutputPath?: string;
};

/**
 * Resolve config: defaults < optional file < CLI overrides.
 */
export function resolveConfig(
  cwd: string,
  overrides: CliConfigOverrides,
): { config: ApiGuardianConfig; configPath: string | undefined } {
  let config = cloneConfig();
  let configPath: string | undefined;

  if (overrides.configPath) {
    const explicit = path.resolve(cwd, overrides.configPath);
    if (!fs.existsSync(explicit)) {
      throw new Error(`Config file not found: ${explicit}`);
    }
    config = loadConfigFromPath(explicit);
    configPath = explicit;
  } else {
    const found = findConfigFile(cwd);
    if (found) {
      config = loadConfigFromPath(found);
      configPath = found;
    }
  }

  if (overrides.projectRoot !== undefined) {
    config.projectRoot = overrides.projectRoot;
  }
  if (overrides.parserTarget !== undefined) {
    config.parser.target = assertParserTarget(overrides.parserTarget);
  }
  if (overrides.diffMode !== undefined) {
    config.diff.mode = overrides.diffMode;
  }
  if (overrides.gitBase !== undefined) {
    config.diff.git.base = overrides.gitBase;
  }
  if (overrides.gitHead !== undefined) {
    config.diff.git.head = overrides.gitHead;
  }
  if (overrides.snapshotBasePath !== undefined) {
    config.diff.snapshot.basePath = overrides.snapshotBasePath;
  }
  if (overrides.snapshotHeadPath !== undefined) {
    config.diff.snapshot.headPath = overrides.snapshotHeadPath;
  }
  if (overrides.snapshotOutputPath !== undefined) {
    config.snapshot.outputPath = overrides.snapshotOutputPath;
  }

  return { config, configPath };
}

export function configJsonForInit(): string {
  return `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`;
}
