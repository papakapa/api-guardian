import type { Contract, ContractEndpoint } from "../types/types";

export function endpointKey(ep: ContractEndpoint): string {
  return `${ep.method} ${ep.path}`;
}

function normalizeParams(params?: string[]): string {
  return JSON.stringify([...(params ?? [])].sort());
}

export type EndpointChange = {
  before: ContractEndpoint;
  after: ContractEndpoint;
};

export type ContractDiffResult = {
  added: ContractEndpoint[];
  removed: ContractEndpoint[];
  /** Same method+path, different params (or one side missing params). */
  changed: EndpointChange[];
};

export function diffContracts(
  base: Contract,
  head: Contract,
): ContractDiffResult {
  const mapBase = new Map(
    base.endpoints.map((ep) => [endpointKey(ep), ep] as const),
  );
  const mapHead = new Map(
    head.endpoints.map((ep) => [endpointKey(ep), ep] as const),
  );

  const added: ContractEndpoint[] = [];
  const removed: ContractEndpoint[] = [];
  const changed: EndpointChange[] = [];

  for (const [key, ep] of mapHead) {
    if (!mapBase.has(key)) {
      added.push(ep);
    }
  }

  for (const [key, ep] of mapBase) {
    if (!mapHead.has(key)) {
      removed.push(ep);
    }
  }

  for (const [key, before] of mapBase) {
    const after = mapHead.get(key);
    if (!after) {
      continue;
    }
    if (normalizeParams(before.params) !== normalizeParams(after.params)) {
      changed.push({ before, after });
    }
  }

  added.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path),
  );
  removed.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path),
  );

  return { added, removed, changed };
}

/**
 * Breaking (MVP): removed endpoints only. Param-only changes are reported but do not fail the run.
 */
export function diffHasBreakingChanges(result: ContractDiffResult): boolean {
  return result.removed.length > 0;
}

export function formatDiffReport(result: ContractDiffResult): string {
  const lines: string[] = [];
  if (result.added.length > 0) {
    lines.push("Added endpoints:");
    for (const ep of result.added) {
      const p = ep.params?.length ? ` params=${JSON.stringify(ep.params)}` : "";
      lines.push(`  + ${ep.method} ${ep.path}${p}`);
    }
    lines.push("");
  }
  if (result.removed.length > 0) {
    lines.push("Removed endpoints (breaking):");
    for (const ep of result.removed) {
      const p = ep.params?.length ? ` params=${JSON.stringify(ep.params)}` : "";
      lines.push(`  - ${ep.method} ${ep.path}${p}`);
    }
    lines.push("");
  }
  if (result.changed.length > 0) {
    lines.push("Changed params (same route):");
    for (const { before, after } of result.changed) {
      lines.push(
        `  ~ ${after.method} ${after.path}: ${JSON.stringify(before.params ?? [])} -> ${JSON.stringify(after.params ?? [])}`,
      );
    }
    lines.push("");
  }
  if (lines.length === 0) {
    return "No API route differences.\n";
  }
  return lines.join("\n");
}
