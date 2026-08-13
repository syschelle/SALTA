function normalizeCss(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function matchingBlockEnd(source: string, openBraceIndex: number): number {
  let depth = 0;
  let quote: "\"" | "\'" | null = null;
  let escaped = false;
  let comment = false;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (comment) {
      if (char === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (char === "\"" || char === "\'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

export function cssRuleBlocks(styles: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...styles.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((match) => match[1] ?? "");
}

export function cssRuleContains(styles: string, selector: string, declaration: string): boolean {
  const expected = normalizeCss(declaration);
  return cssRuleBlocks(styles, selector).some((block) => normalizeCss(block).includes(expected));
}

export function cssMediaBlocks(styles: string, condition: string): string[] {
  const expectedHeader = normalizeCss(`@media${condition}`);
  const blocks: string[] = [];
  let offset = 0;

  while (offset < styles.length) {
    const mediaIndex = styles.indexOf("@media", offset);
    if (mediaIndex < 0) break;
    const openBraceIndex = styles.indexOf("{", mediaIndex);
    if (openBraceIndex < 0) break;

    const header = normalizeCss(styles.slice(mediaIndex, openBraceIndex));
    const closeBraceIndex = matchingBlockEnd(styles, openBraceIndex);
    if (closeBraceIndex < 0) break;

    if (header === expectedHeader) {
      blocks.push(styles.slice(openBraceIndex + 1, closeBraceIndex));
    }
    offset = closeBraceIndex + 1;
  }

  return blocks;
}

export function cssMediaRuleContains(
  styles: string,
  condition: string,
  selector: string,
  declaration: string,
): boolean {
  return cssMediaBlocks(styles, condition).some((block) => cssRuleContains(block, selector, declaration));
}
