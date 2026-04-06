import { Node, type MethodDeclaration } from "ts-morph";

import { decoratorNameFromText } from "./text";

export const mergeParamNamesUniqueOrdered = (
  pathNames: string[],
  decoratorNames: string[],
): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of pathNames) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  for (const n of decoratorNames) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Nest `@Param()` names on a handler method. */
export const extractParamNamesFromMethod = (
  method: MethodDeclaration,
): string[] => {
  const names: string[] = [];
  for (const param of method.getParameters()) {
    const paramDecorator = param
      .getDecorators()
      .find(
        (d) =>
          decoratorNameFromText(d.getText().split("\n")[0]?.trim() ?? "") ===
          "param",
      );
    if (!paramDecorator) {
      continue;
    }
    const call = paramDecorator.getCallExpression();
    if (!call) {
      names.push(param.getName());
      continue;
    }
    const args = call.getArguments();
    const first = args[0];
    if (first && Node.isStringLiteral(first)) {
      names.push(first.getLiteralValue());
    } else {
      names.push(param.getName());
    }
  }
  return names;
}
