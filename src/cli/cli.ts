import * as fs from "node:fs";
import * as path from "node:path";
import { Command } from "commander";

import {
  configJsonForInit,
  DEFAULT_CONFIG_FILE,
  resolveConfig,
  type CliConfigOverrides,
} from "../config/config";
import { readContractFile } from "../parsers/contract-io";
import {
  diffContracts,
  diffHasBreakingChanges,
  formatDiffReport,
} from "../engines/diff.engine";
import { extractContract } from "../parsers";
import { getGitRoot, withGitWorktree } from "../engines/git-worktree.engine";
import type { DiffMode, ParserTarget } from "../types/types";

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

function resolveProjectAbsolute(cwd: string, projectRoot: string): string {
  return path.resolve(cwd, projectRoot);
}

const program = new Command();

program
  .name("api-guardian")
  .description(
    "Extract and diff HTTP route contracts from TypeScript/JavaScript apps (parser targets: nest, …)",
  )
  .showHelpAfterError();

program
  .command("init")
  .description(`Write ${DEFAULT_CONFIG_FILE} with default settings`)
  .option("-c, --config <path>", "Config file path", DEFAULT_CONFIG_FILE)
  .option("-f, --force", "Overwrite existing config file", false)
  .action((opts: { config: string; force: boolean }) => {
    const cwd = process.cwd();
    const target = path.resolve(cwd, opts.config);
    if (fs.existsSync(target) && !opts.force) {
      die(`Config already exists: ${target}\nUse --force to overwrite.`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, configJsonForInit(), "utf8");
    console.log(`Wrote ${target}`);
  });

program
  .command("snapshot")
  .description(
    "Extract route contract from the configured project and write JSON",
  )
  .option("-c, --config <path>", "Config file path")
  .option(
    "-o, --output <path>",
    "Output JSON path (overrides config snapshot.outputPath)",
  )
  .option(
    "--project-root <dir>",
    "Directory with tsconfig for extraction (overrides config projectRoot)",
  )
  .option(
    "--parser-target <target>",
    'Parser implementation: only "nest" today',
    (v: string) => {
      if (v !== "nest") {
        throw new Error('parser-target must be "nest"');
      }
      return v as ParserTarget;
    },
  )
  .option("-v, --verbose", "Log TypeScript diagnostics", false)
  .action(
    async (opts: {
      config?: string;
      output?: string;
      projectRoot?: string;
      parserTarget?: ParserTarget;
      verbose?: boolean;
    }) => {
      const cwd = process.cwd();
      const overrides: CliConfigOverrides = {
        configPath: opts.config,
        projectRoot: opts.projectRoot,
        parserTarget: opts.parserTarget,
        snapshotOutputPath: opts.output,
      };
      let config;
      try {
        ({ config } = resolveConfig(cwd, overrides));
      } catch (e) {
        die(e instanceof Error ? e.message : String(e));
      }
      const appRoot = resolveProjectAbsolute(cwd, config.projectRoot);
      const outAbs = path.resolve(cwd, config.snapshot.outputPath);
      let contract;
      try {
        contract = extractContract(appRoot, {
          logDiagnostics: Boolean(opts.verbose),
          target: config.parser.target,
        });
      } catch (e) {
        die(e instanceof Error ? e.message : String(e));
      }
      await fs.promises.mkdir(path.dirname(outAbs), { recursive: true });
      await fs.promises.writeFile(
        outAbs,
        `${JSON.stringify(contract, null, 2)}\n`,
        "utf8",
      );
      console.log(`Wrote ${outAbs} (${contract.endpoints.length} endpoints)`);
    },
  );

program
  .command("diff")
  .description("Compare two route contracts (git refs or snapshot JSON files)")
  .option("-c, --config <path>", "Config file path")
  .option("-m, --mode <mode>", "git | snapshot", (v: string) => {
    if (v !== "git" && v !== "snapshot") {
      throw new Error("mode must be git or snapshot");
    }
    return v as DiffMode;
  })
  .option("--base <refOrPath>", "Git base ref or snapshot JSON path")
  .option("--head <refOrPath>", "Git head ref or snapshot JSON path")
  .option(
    "--project-root <dir>",
    "Project root relative to repo (git mode); directory with tsconfig under each worktree",
  )
  .option("--nest-app-root <dir>", "Deprecated: same as --project-root")
  .option(
    "--parser-target <target>",
    'Parser for git extraction: only "nest"',
    (v: string) => {
      if (v !== "nest") {
        throw new Error('parser-target must be "nest"');
      }
      return v as ParserTarget;
    },
  )
  .option("-v, --verbose", "Log TypeScript diagnostics when extracting", false)
  .action(
    (opts: {
      config?: string;
      mode?: DiffMode;
      base?: string;
      head?: string;
      projectRoot?: string;
      parserTarget?: ParserTarget;
      verbose?: boolean;
    }) => {
      const cwd = process.cwd();
      let config;
      try {
        ({ config } = resolveConfig(cwd, {
          configPath: opts.config,
          projectRoot: opts.projectRoot,
          parserTarget: opts.parserTarget,
        }));
      } catch (e) {
        die(e instanceof Error ? e.message : String(e));
      }
      const mode = opts.mode ?? config.diff.mode;

      if (mode === "snapshot") {
        const basePath = (opts.base ?? config.diff.snapshot.basePath).trim();
        const headPath = (opts.head ?? config.diff.snapshot.headPath).trim();
        if (!basePath || !headPath) {
          die(
            "Snapshot diff requires explicit --base and --head (paths to contract JSON files), or diff.snapshot.basePath and diff.snapshot.headPath in config.",
          );
        }
        const baseAbs = path.resolve(cwd, basePath);
        const headAbs = path.resolve(cwd, headPath);
        let baseContract;
        let headContract;
        try {
          baseContract = readContractFile(baseAbs);
          headContract = readContractFile(headAbs);
        } catch (e) {
          die(e instanceof Error ? e.message : String(e));
        }
        const snapResult = diffContracts(baseContract, headContract);
        console.log(formatDiffReport(snapResult));
        process.exit(diffHasBreakingChanges(snapResult) ? 1 : 0);
      } else {
        let repoRoot: string;
        try {
          repoRoot = getGitRoot(cwd);
        } catch (e) {
          die(e instanceof Error ? e.message : String(e));
        }

        const baseRef = opts.base ?? config.diff.git.base;
        const headRef = opts.head ?? config.diff.git.head;
        const projRel = opts.projectRoot ?? config.projectRoot;
        const verbose = Boolean(opts.verbose);
        const parserTarget = opts.parserTarget ?? config.parser.target;

        let baseContract;
        let headContract;
        try {
          baseContract = withGitWorktree(repoRoot, baseRef, (wt) =>
            extractContract(path.resolve(wt, projRel), {
              logDiagnostics: verbose,
              target: parserTarget,
            }),
          );
          headContract = withGitWorktree(repoRoot, headRef, (wt) =>
            extractContract(path.resolve(wt, projRel), {
              logDiagnostics: verbose,
              target: parserTarget,
            }),
          );
        } catch (e) {
          die(e instanceof Error ? e.message : String(e));
        }

        const gitResult = diffContracts(baseContract, headContract);
        console.log(formatDiffReport(gitResult));
        process.exit(diffHasBreakingChanges(gitResult) ? 1 : 0);
      }
    },
  );

program.parse(process.argv);
