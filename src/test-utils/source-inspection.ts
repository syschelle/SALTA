import ts from "typescript";

export function parseJavaScriptSource(source: string, fileName = "app.js"): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

function findFunctionNode(sourceFile: ts.SourceFile, functionName: string): ts.FunctionLikeDeclaration {
  let result: ts.FunctionLikeDeclaration | undefined;

  const visit = (node: ts.Node): void => {
    if (result) return;

    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      result = node;
      return;
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === functionName) {
      const initializer = node.initializer;
      if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
        result = initializer;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!result) {
    throw new Error(`Function ${functionName} was not found in ${sourceFile.fileName}`);
  }

  return result;
}

function callName(expression: ts.LeftHandSideExpression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

export function hasFunction(sourceFile: ts.SourceFile, functionName: string): boolean {
  try {
    findFunctionNode(sourceFile, functionName);
    return true;
  } catch {
    return false;
  }
}

export function functionSource(sourceFile: ts.SourceFile, functionName: string): string {
  return findFunctionNode(sourceFile, functionName).getText(sourceFile);
}

export function functionCalls(
  sourceFile: ts.SourceFile,
  containingFunctionName: string,
  calledFunctionName: string,
  minimumArgumentCount = 0,
): boolean {
  const functionNode = findFunctionNode(sourceFile, containingFunctionName);
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      callName(node.expression) === calledFunctionName &&
      node.arguments.length >= minimumArgumentCount
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(functionNode, visit);
  return found;
}
export function functionTransitivelyCalls(
  sourceFile: ts.SourceFile,
  startingFunctionName: string,
  calledFunctionName: string,
  minimumArgumentCount = 0,
  maximumDepth = 8,
): boolean {
  const visited = new Set<string>();

  const visitFunction = (functionName: string, depth: number): boolean => {
    if (depth > maximumDepth || visited.has(functionName)) return false;
    visited.add(functionName);

    const functionNode = findFunctionNode(sourceFile, functionName);
    const nestedCalls: string[] = [];
    let found = false;

    const visit = (node: ts.Node): void => {
      if (found) return;
      if (ts.isCallExpression(node)) {
        const name = callName(node.expression);
        if (name === calledFunctionName && node.arguments.length >= minimumArgumentCount) {
          found = true;
          return;
        }
        if (name && name !== functionName) nestedCalls.push(name);
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(functionNode, visit);
    if (found) return true;

    for (const nestedCall of nestedCalls) {
      try {
        if (visitFunction(nestedCall, depth + 1)) return true;
      } catch {
        // Calls to browser APIs, methods and imported helpers are not local functions.
      }
    }
    return false;
  };

  return visitFunction(startingFunctionName, 0);
}

