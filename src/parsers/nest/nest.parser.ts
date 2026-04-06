import * as fs from "node:fs";
import * as path from "node:path";
import { Project, type SourceFile } from "ts-morph";

import type { Contract, ExtractContractOptions } from "../../types/types";
import { buildContractFromNestDecoratorSummary } from "./nest-contract.builder";
import { summarizeNestDecorators } from "./utils/decorators";

const resolveTsConfigForProject = (appRoot: string): string => {
  const build = path.join(appRoot, "tsconfig.build.json");
  const base = path.join(appRoot, "tsconfig.json");
  if (fs.existsSync(build)) {
    return build;
  }
  if (fs.existsSync(base)) {
    return base;
  }
  throw new Error(`No tsconfig.json (or tsconfig.build.json) under ${appRoot}`);
}

/**
 * Walk source files and merge per-file contracts into one.
 */
const mergeContractsFromProject = (
  project: Project,
  logDiagnostics: boolean | undefined,
): Contract => {
  if (logDiagnostics) {
    const diagnostics = project.getPreEmitDiagnostics();
    if (diagnostics.length > 0) {
      console.warn(
        `TypeScript diagnostics (first ${Math.min(5, diagnostics.length)}):`,
      );
      for (const d of diagnostics.slice(0, 5)) {
        console.warn(`  ${d.getMessageText()}`);
      }
      if (diagnostics.length > 5) {
        console.warn(`  ... and ${diagnostics.length - 5} more`);
      }
    }
  }

  const files = project
    .getSourceFiles()
    .filter(
      (sf: SourceFile) =>
        !sf.getFilePath().includes(`${path.sep}node_modules${path.sep}`),
    );

  const appContract: Contract = { endpoints: [] };
  const endpointKeys = new Set<string>();

  for (const sf of files) {
    const summary = summarizeNestDecorators(sf);
    const fileContract = buildContractFromNestDecoratorSummary(summary);
    for (const ep of fileContract.endpoints) {
      const key = `${ep.method} ${ep.path}`;
      if (endpointKeys.has(key)) {
        continue;
      }
      endpointKeys.add(key);
      appContract.endpoints.push(ep);
    }
  }

  appContract.endpoints.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path),
  );

  return appContract;
}

/**
 * NestJS: decorators + ts-morph project → {@link Contract}.
 */
export const extractNestContract = (
  appRoot: string,
  options?: Pick<ExtractContractOptions, "logDiagnostics">,
): Contract => {
  const absolute = path.resolve(appRoot);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Project root not found: ${absolute}`);
  }

  const tsConfigFilePath = resolveTsConfigForProject(absolute);
  const project = new Project({
    tsConfigFilePath,
    skipAddingFilesFromTsConfig: false,
  });

  return mergeContractsFromProject(project, options?.logDiagnostics);
}
