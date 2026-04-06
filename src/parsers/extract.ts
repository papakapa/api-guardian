import type {
  Contract,
  ExtractContractOptions,
  ParserTarget,
} from "../types/types";
import { extractNestContract } from "./nest/nest.parser";

const SUPPORTED_TARGETS: readonly ParserTarget[] = ["nest"];

const assertTarget = (target: ParserTarget): void => {
  if (!SUPPORTED_TARGETS.includes(target)) {
    throw new Error(
      `Unsupported parser target "${target}". Supported: ${SUPPORTED_TARGETS.join(", ")}.`,
    );
  }
}

/**
 * Run the configured source parser and return a normalized HTTP route contract.
 */
export const extractContract = (
  appRoot: string,
  options?: ExtractContractOptions,
): Contract => {
  const target = options?.target ?? "nest";
  assertTarget(target);

  if (target === "nest") {
    return extractNestContract(appRoot, options);
  }

  throw new Error("Unreachable parser branch");
}
