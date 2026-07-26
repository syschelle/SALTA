function normalizeCss(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export function cssRuleBlocks(styles: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...styles.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((match) => match[1] ?? "");
}

export function cssRuleContains(styles: string, selector: string, declaration: string): boolean {
  const expected = normalizeCss(declaration);
  return cssRuleBlocks(styles, selector).some((block) => normalizeCss(block).includes(expected));
}
