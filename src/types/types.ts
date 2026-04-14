export type Primitive = "string" | "number" | "boolean";

/**
 * JSON property key for a bare Nest `@Body()` (entire request body) in
 * {@link ContractEndpoint.bodyType}.
 */
export const NEST_BODY_ROOT_KEY = "*";

export type ContractEndpoint = {
  path: string;
  method: string;
  /** Route / handler param names (no types in MVP). */
  params?: string[];
  /** Primitive types for route params; only parameters with primitive annotations are listed. */
  paramTypes?: Record<string, Primitive>;
  /**
   * Primitive body fields: `@Body('x')` → key `x`; `@Body()` → key {@link NEST_BODY_ROOT_KEY}.
   * Duplicate keys follow last-wins (decorator order, then parameter order).
   */
  bodyType?: Record<string, Primitive>;
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
