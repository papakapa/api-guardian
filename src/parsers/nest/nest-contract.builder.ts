import type { Contract, ContractEndpoint } from '../../types/types';
import {
  type DecoratorSummaryItem,
  DecoratorType,
  isNestHttpMethodComponent,
  nestHttpVerbForComponent,
} from './utils/decorators';
import {
  extractParamNamesFromRouteSegments,
  normalizeContractPath,
} from './utils/paths';
import { mergeParamNamesUniqueOrdered } from './utils/params';

export const buildContractFromNestDecoratorSummary = (
  summary: DecoratorSummaryItem[],
): Contract => {
  const controllerPrefixesByClass = new Map<string, string[]>();

  for (const item of summary) {
    if (item.type !== DecoratorType.Class || item.component !== 'controller') {
      continue;
    }
    const prefixes = item.controllerPrefixes ?? [''];
    const prev = controllerPrefixesByClass.get(item.className);
    const merged = prev ? [...prev, ...prefixes] : [...prefixes];
    controllerPrefixesByClass.set(item.className, [...new Set(merged)]);
  }

  const seen = new Set<string>();
  const endpoints: ContractEndpoint[] = [];

  for (const item of summary) {
    if (
      item.type !== DecoratorType.Method ||
      !isNestHttpMethodComponent(item.component)
    ) {
      continue;
    }
    const method = nestHttpVerbForComponent(item.component)!;
    const subpath = item.handlerSubpath ?? '';
    const prefixes = controllerPrefixesByClass.get(item.className) ?? [''];

    for (const prefix of prefixes) {
      const routePath = normalizeContractPath([prefix, subpath]);
      const key = `${method} ${routePath}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const fromPath = extractParamNamesFromRouteSegments([prefix, subpath]);
      const fromDecorators = item.handlerParamNames ?? [];
      const mergedParams = mergeParamNamesUniqueOrdered(
        fromPath,
        fromDecorators,
      );
      const ep: ContractEndpoint = { path: routePath, method };
      if (mergedParams.length > 0) {
        ep.params = mergedParams;
      }

      if (item.handlerParamTypes) {
        ep.paramTypes = item.handlerParamTypes;
      }

      if (item.handlerBodyTypes) {
        ep.bodyType = item.handlerBodyTypes;
      }

      endpoints.push(ep);
    }
  }

  endpoints.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path),
  );

  return { endpoints };
};
