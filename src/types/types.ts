export type ContractEndpoint = {
  path: string;
  method: string;
  /** Route / handler param names (no types in MVP). */
  params?: string[];
};

export type Contract = {
  endpoints: ContractEndpoint[];
};

export type DiffMode = "git" | "snapshot";

/**
 * Route extractor implementation. Only `nest` is implemented for now;
 * more targets (other frameworks, plain TS/JS) are planned.
 */
export type ParserTarget = "nest";

export type ExtractContractOptions = {
  /** Log first N TypeScript diagnostics to stderr (default: false). */
  logDiagnostics?: boolean;
  /** Which parser to run; default `nest`. */
  target?: ParserTarget;
};

export type ApiGuardianConfig = {
  version: number;
  /**
   * Directory containing `tsconfig.json` (or `tsconfig.build.json`) for the
   * project to analyze. Relative to cwd.
   */
  projectRoot: string;
  /**
   * How source is turned into a {@link Contract}. Extend with new targets over time.
   */
  parser: {
    target: ParserTarget;
  };
  diff: {
    mode: DiffMode;
    git: {
      base: string;
      head: string;
    };
    snapshot: {
      basePath: string;
      headPath: string;
    };
  };
  snapshot: {
    outputPath: string;
  };
};
