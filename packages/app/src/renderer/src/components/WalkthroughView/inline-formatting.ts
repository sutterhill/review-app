export type InlineToken =
  | { id: string; text: string; type: "bold" }
  | { id: string; text: string; type: "code" }
  | { id: string; text: string; type: "italic" }
  | { id: string; text: string; type: "text" };

const TOKEN_PATTERN =
  /`([^`]+)`|\*\*([^*]+?)\*\*|__([^_]+?)__|(?<![\w*])\*([^*\s](?:[^*]*[^*\s])?)\*(?![\w*])|(?<![\w_])_([^_\s](?:[^_]*[^_\s])?)_(?![\w_])/gu;

export const parseInlineFormatting = (text: string): InlineToken[] => {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let counter = 0;

  const pushText = (slice: string): void => {
    if (slice.length === 0) return;
    counter += 1;
    tokens.push({ id: `t${counter}`, text: slice, type: "text" });
  };

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) pushText(text.slice(lastIndex, matchIndex));

    counter += 1;
    if (match[1] !== undefined) {
      tokens.push({ id: `c${counter}`, text: match[1], type: "code" });
    } else if (match[2] !== undefined || match[3] !== undefined) {
      tokens.push({ id: `b${counter}`, text: (match[2] ?? match[3]) as string, type: "bold" });
    } else if (match[4] !== undefined || match[5] !== undefined) {
      tokens.push({ id: `i${counter}`, text: (match[4] ?? match[5]) as string, type: "italic" });
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) pushText(text.slice(lastIndex));
  return tokens;
};
