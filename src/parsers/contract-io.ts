import * as fs from "node:fs";

import type { Contract } from "../types/types";

export function parseContractJson(raw: string, label: string): Contract {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Invalid JSON in ${label}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!data || typeof data !== "object") {
    throw new Error(`${label}: expected an object`);
  }
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.endpoints)) {
    throw new Error(`${label}: expected { endpoints: [...] }`);
  }
  for (const ep of o.endpoints) {
    if (!ep || typeof ep !== "object") {
      throw new Error(`${label}: invalid endpoint entry`);
    }
    const e = ep as Record<string, unknown>;
    if (typeof e.path !== "string" || typeof e.method !== "string") {
      throw new Error(`${label}: endpoint must have string path and method`);
    }
    if (
      e.params !== undefined &&
      (!Array.isArray(e.params) ||
        !e.params.every((p) => typeof p === "string"))
    ) {
      throw new Error(`${label}: endpoint.params must be an array of strings`);
    }
  }
  return data as Contract;
}

export function readContractFile(filePath: string): Contract {
  const raw = fs.readFileSync(filePath, "utf8");
  return parseContractJson(raw, filePath);
}
