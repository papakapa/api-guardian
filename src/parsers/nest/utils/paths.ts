import { Node, type Decorator } from "ts-morph";

export const normalizeContractPath = (segments: string[]): string => {
  const parts = segments
    .flatMap((s) => s.split("/"))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    return "/";
  }
  return `/${parts.join("/")}`;
}

/** `:id` and `:id(\\d+)`-style segments; order follows the full route left-to-right. */
export const extractParamNamesFromRouteSegments = (
  segments: string[],
): string[] => {
  const parts = segments
    .flatMap((s) => s.split("/"))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const names: string[] = [];
  for (const seg of parts) {
    if (!seg.startsWith(":")) {
      continue;
    }
    const withoutColon = seg.slice(1);
    const base = withoutColon.split("(")[0] ?? withoutColon;
    if (base.length > 0) {
      names.push(base);
    }
  }
  return names;
}

export const parsePathArgumentPrefixes = (arg: Node): string[] => {
  if (Node.isStringLiteral(arg)) {
    return [arg.getLiteralValue()];
  }
  if (Node.isArrayLiteralExpression(arg)) {
    const literals = arg
      .getElements()
      .filter(Node.isStringLiteral)
      .map((e) => e.getLiteralValue());
    return literals.length > 0 ? literals : [""];
  }
  if (Node.isObjectLiteralExpression(arg)) {
    const pathProp = arg.getProperty("path");
    if (pathProp && Node.isPropertyAssignment(pathProp)) {
      const init = pathProp.getInitializer();
      if (init) {
        return parsePathArgumentPrefixes(init);
      }
    }
    return [""];
  }
  return [""];
}

export const extractControllerPrefixes = (dec: Decorator): string[] => {
  const call = dec.getCallExpression();
  if (!call) {
    return [""];
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return [""];
  }
  const first = args[0];
  if (!first) {
    return [""];
  }
  return parsePathArgumentPrefixes(first);
}

export const extractHandlerSubpath = (dec: Decorator): string => {
  const call = dec.getCallExpression();
  if (!call) {
    return "";
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return "";
  }
  const staticParts: string[] = [];
  for (const arg of args) {
    if (Node.isStringLiteral(arg)) {
      staticParts.push(arg.getLiteralValue());
    } else {
      break;
    }
  }
  return staticParts.join("/");
}
