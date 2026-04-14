import { Node, SyntaxKind, type Decorator, type SourceFile } from "ts-morph";

import type { Primitive } from "../../../types/types";
import { extractControllerPrefixes, extractHandlerSubpath } from "./paths";
import {
  extractBodyTypesFromMethod,
  extractParamNamesFromMethod,
  extractParamTypesFromMethod,
} from "./params";
import { decoratorNameFromText } from "./text";

export enum DecoratorType {
  Method = "method",
  Class = "class",
}

export type DecoratorSummaryItem = {
  type: DecoratorType;
  component: string;
  className: string;
  methodName?: string;
  host: string;
  name: string;
  controllerPrefixes?: string[];
  handlerSubpath?: string;
  handlerParamNames?: string[];
  handlerParamTypes?: Record<string, Primitive>;
  /**
   * bare `@Body()` uses the root key from `NEST_BODY_ROOT_KEY` in contract output;
   * `@Body('key')` uses `key`.
   * Later decorators / parameters win on duplicate keys.
   */
  handlerBodyTypes?: Record<string, Primitive>;
};

const NEST_HTTP_COMPONENT_TO_VERB: Record<string, string> = {
  get: "GET",
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
  options: "OPTIONS",
  head: "HEAD",
  all: "ALL",
  search: "SEARCH",
};

export function isNestHttpMethodComponent(component: string): boolean {
  return component in NEST_HTTP_COMPONENT_TO_VERB;
}

export function nestHttpVerbForComponent(
  component: string,
): string | undefined {
  return NEST_HTTP_COMPONENT_TO_VERB[component];
}

export function summarizeNestDecorators(
  sf: SourceFile,
): DecoratorSummaryItem[] {
  const summary: DecoratorSummaryItem[] = [];
  for (const dec of sf.getDescendants()) {
    if (!Node.isDecorator(dec)) {
      continue;
    }
    const parent = dec.getParent();
    if (
      !Node.isClassDeclaration(parent) &&
      !Node.isMethodDeclaration(parent) &&
      !Node.isPropertyDeclaration(parent)
    ) {
      continue;
    }

    const text = dec.getText().split("\n")[0]?.trim() ?? dec.getText().trim();
    const component = decoratorNameFromText(text);

    let type: DecoratorType;
    let className: string;
    let methodName: string | undefined;
    let host: string;

    if (Node.isClassDeclaration(parent)) {
      type = DecoratorType.Class;
      className = parent.getName() ?? "?";
      host = className;
    } else {
      type = DecoratorType.Method;
      const cls = parent.getParentIfKind(SyntaxKind.ClassDeclaration);
      className = cls?.getName() ?? "?";
      if (Node.isMethodDeclaration(parent)) {
        methodName = parent.getName();
      } else {
        methodName = parent.getName();
      }
      host =
        methodName !== undefined ? `${className}.${methodName}` : className;
    }

    const item: DecoratorSummaryItem = {
      type,
      component,
      className,
      methodName,
      host,
      name: text,
    };

    if (type === DecoratorType.Class && component === "controller") {
      item.controllerPrefixes = extractControllerPrefixes(dec as Decorator);
    }
    if (type === DecoratorType.Method && isNestHttpMethodComponent(component)) {
      item.handlerSubpath = extractHandlerSubpath(dec as Decorator);
      if (Node.isMethodDeclaration(parent)) {
        item.handlerParamNames = extractParamNamesFromMethod(parent);
        item.handlerParamTypes = extractParamTypesFromMethod(parent);
        item.handlerBodyTypes = extractBodyTypesFromMethod(parent);
      }
    }

    summary.push(item);
  }
  return summary;
}
