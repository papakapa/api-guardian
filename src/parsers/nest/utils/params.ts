import { Node, type Decorator, type MethodDeclaration } from 'ts-morph';

import { NEST_BODY_ROOT_KEY, type Primitive } from '../../../types/types';
import { decoratorNameFromText } from './text';

const PRIMITIVE_TYPES = new Set<Primitive>(['string', 'number', 'boolean']);

const resolvePrimitiveType = (
  typeName: string | undefined,
): Primitive | undefined => {
  if (!typeName) {
    return undefined;
  }
  const trimmed = typeName.trim();
  if (PRIMITIVE_TYPES.has(trimmed as Primitive)) {
    return trimmed as Primitive;
  }
  return undefined;
};

const decoratorBaseName = (d: Decorator): string =>
  decoratorNameFromText(d.getText().split('\n')[0]?.trim() ?? '');

const paramDecoratorsFor = (param: {
  getDecorators: () => Decorator[];
}): Decorator[] =>
  param.getDecorators().filter((d) => decoratorBaseName(d) === 'param');

const bodyDecoratorsFor = (param: {
  getDecorators: () => Decorator[];
}): Decorator[] =>
  param.getDecorators().filter((d) => decoratorBaseName(d) === 'body');

const routeKeyFromParamDecorator = (
  paramDecorator: Decorator,
  parameterName: string,
): string => {
  const call = paramDecorator.getCallExpression();
  if (!call) {
    return parameterName;
  }
  const args = call.getArguments();
  const first = args[0];
  if (first && Node.isStringLiteral(first)) {
    return first.getLiteralValue();
  }
  if (first && Node.isNoSubstitutionTemplateLiteral(first)) {
    return first.getLiteralValue();
  }
  return parameterName;
};

const bodyPropertyKeyFromDecorator = (dec: Decorator): string => {
  const call = dec.getCallExpression();
  if (!call) {
    return NEST_BODY_ROOT_KEY;
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return NEST_BODY_ROOT_KEY;
  }
  const first = args[0];
  if (
    Node.isStringLiteral(first) ||
    Node.isNoSubstitutionTemplateLiteral(first)
  ) {
    return first.getLiteralValue();
  }
  return NEST_BODY_ROOT_KEY;
};

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
};

/** Nest `@Param()` names on a handler method (all `@Param` decorators per parameter). */
export const extractParamNamesFromMethod = (
  method: MethodDeclaration,
): string[] => {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const param of method.getParameters()) {
    const decs = paramDecoratorsFor(param);
    if (decs.length === 0) {
      continue;
    }
    for (const paramDecorator of decs) {
      const key = routeKeyFromParamDecorator(paramDecorator, param.getName());
      if (!seen.has(key)) {
        seen.add(key);
        names.push(key);
      }
    }
  }
  return names;
};

/** Primitive type per route param name; non-primitive parameters are omitted. */
export const extractParamTypesFromMethod = (
  method: MethodDeclaration,
): Record<string, Primitive> | undefined => {
  const types: Record<string, Primitive> = {};
  for (const param of method.getParameters()) {
    const decs = paramDecoratorsFor(param);
    if (decs.length === 0) {
      continue;
    }
    const primitive = resolvePrimitiveType(param.getTypeNode()?.getText());
    if (!primitive) {
      continue;
    }
    for (const paramDecorator of decs) {
      const paramName = routeKeyFromParamDecorator(
        paramDecorator,
        param.getName(),
      );
      types[paramName] = primitive;
    }
  }
  return Object.keys(types).length > 0 ? types : undefined;
};

/**
 * Primitive types for `@Body()` / `@Body('prop')` bindings.
 * Whole-body `@Body()` maps to {@link NEST_BODY_ROOT_KEY}.
 */
export const extractBodyTypesFromMethod = (
  method: MethodDeclaration,
): Record<string, Primitive> | undefined => {
  const out: Record<string, Primitive> = {};
  for (const param of method.getParameters()) {
    const decs = bodyDecoratorsFor(param);
    if (decs.length === 0) {
      continue;
    }
    const primitive = resolvePrimitiveType(param.getTypeNode()?.getText());
    if (!primitive) {
      continue;
    }
    for (const bodyDec of decs) {
      const key = bodyPropertyKeyFromDecorator(bodyDec);
      out[key] = primitive;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
};
