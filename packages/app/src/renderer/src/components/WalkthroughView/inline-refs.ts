import type { LineRange } from "../../store/walkthrough/walkthrough-types";

export interface InlineRef {
  lineRanges: LineRange[];
  path: string;
  symbol: string | null;
}

export interface TextNode {
  text: string;
  type: "text";
}

export interface RefNode extends InlineRef {
  type: "ref";
}

export type InlineNode = RefNode | TextNode;

const REF_PATTERN = /\{\{ref:([^}]+)\}\}/gu;

export const parseInlineRef = (raw: string): InlineRef => {
  const trimmed = raw.trim();
  const hashIndex = trimmed.indexOf("#");
  if (hashIndex < 0) {
    return { lineRanges: [], path: trimmed, symbol: null };
  }
  const path = trimmed.slice(0, hashIndex);
  const fragment = trimmed.slice(hashIndex + 1);
  if (fragment.startsWith("symbol:")) {
    return { lineRanges: [], path, symbol: fragment.slice("symbol:".length) };
  }
  const lineRanges: LineRange[] = [];
  for (const part of fragment.split(",")) {
    const range = parseLineRange(part);
    if (range) lineRanges.push(range);
  }
  return { lineRanges, path, symbol: null };
};

const parseLineRange = (input: string): LineRange | null => {
  const trimmed = input.trim().replace(/^L/iu, "");
  if (trimmed.length === 0) return null;
  const dashIndex = trimmed.indexOf("-");
  if (dashIndex < 0) {
    const single = Number.parseInt(trimmed, 10);
    if (Number.isFinite(single) && single > 0) return [single, single];
    return null;
  }
  const start = Number.parseInt(trimmed.slice(0, dashIndex), 10);
  const end = Number.parseInt(trimmed.slice(dashIndex + 1).replace(/^L/iu, ""), 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) return null;
  return [start, end];
};

export const parseInlineNodes = (body: string): InlineNode[] => {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(REF_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      nodes.push({ text: body.slice(lastIndex, matchIndex), type: "text" });
    }
    const ref = parseInlineRef(match[1] ?? "");
    nodes.push({ ...ref, type: "ref" });
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < body.length) {
    nodes.push({ text: body.slice(lastIndex), type: "text" });
  }
  return nodes;
};

export const extractRelevantFiles = (
  body: string,
): Array<{ lineRanges: LineRange[]; path: string }> => {
  const pathMap = new Map<string, LineRange[]>();
  for (const node of parseInlineNodes(body)) {
    if (node.type !== "ref") continue;
    const existing = pathMap.get(node.path) ?? [];
    pathMap.set(node.path, existing.concat(node.lineRanges));
  }
  return Array.from(pathMap, ([path, lineRanges]) => ({ lineRanges, path }));
};
