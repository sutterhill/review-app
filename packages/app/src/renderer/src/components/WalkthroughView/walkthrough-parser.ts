export interface WalkthroughSection {
  id: string;
  markdown: string;
}

export interface WalkthroughHeading {
  id: string;
  level: number;
  text: string;
}

export type WalkthroughChunk =
  | { markdown: string; type: "prose" }
  | { code: string; label?: string; type: "diff" };

export const buildWalkthroughSections = (walkthrough: string): WalkthroughSection[] =>
  splitWalkthroughBlocks(walkthrough).map((markdown, index) => ({
    id: `walkthrough-${index}`,
    markdown,
  }));

export const extractWalkthroughHeadings = (walkthrough: string): WalkthroughHeading[] => {
  const headings: WalkthroughHeading[] = [];
  for (const line of walkthrough.split("\n")) {
    const match = line.match(/^(#{1,4})\s+(.+)$/u);
    if (match) {
      const level = match[1]?.length ?? 1;
      const text = match[2] ?? "";
      headings.push({ id: `wt-${headings.length}`, level, text });
    }
  }
  return headings;
};

export const splitIntoChunks = (markdown: string): WalkthroughChunk[] => {
  const chunks: WalkthroughChunk[] = [];
  const proseLines: string[] = [];
  let currentDiff: { label?: string; lines: string[] } | null = null;
  let inOtherCodeFence = false;

  const flushProse = (): void => {
    const text = proseLines
      .join("\n")
      .trim()
      .replace(/\n{3,}/gu, "\n\n");
    if (text.length > 0) {
      chunks.push({ markdown: text, type: "prose" });
    }
    proseLines.length = 0;
  };

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();

    if (currentDiff !== null) {
      if (trimmed === "```") {
        flushProse();
        chunks.push({ code: currentDiff.lines.join("\n"), label: currentDiff.label, type: "diff" });
        currentDiff = null;
      } else {
        currentDiff.lines.push(line);
      }
      continue;
    }

    if (!inOtherCodeFence && trimmed.startsWith("```diff")) {
      const previousLine = proseLines.at(-1);
      const labelMatch =
        previousLine?.trim().match(/^\*(.+)\*$/u) ?? previousLine?.trim().match(/^_(.+)_$/u);
      const label = labelMatch?.[1]?.trim();
      if (label) {
        proseLines.pop();
      }
      currentDiff = { label, lines: [] };
      continue;
    }

    if (trimmed.startsWith("```")) {
      inOtherCodeFence = !inOtherCodeFence;
    }

    proseLines.push(line);
  }

  if (currentDiff !== null) {
    if (currentDiff.label) {
      proseLines.push(`*${currentDiff.label}*`);
    }
    proseLines.push("```diff");
    proseLines.push(...currentDiff.lines);
  }

  flushProse();
  return chunks;
};

const splitWalkthroughBlocks = (walkthrough: string): string[] => {
  const blocks: string[] = [];
  const current: string[] = [];
  let isCodeFence = false;

  for (const line of walkthrough.replaceAll("\r\n", "\n").trim().split("\n")) {
    if (line.trim().startsWith("```")) {
      isCodeFence = !isCodeFence;
    }

    if (!isCodeFence && line.trim().length === 0) {
      flushBlock(blocks, current);
      continue;
    }

    current.push(line);
  }

  flushBlock(blocks, current);
  return blocks;
};

const flushBlock = (blocks: string[], current: string[]): void => {
  if (current.length === 0) {
    return;
  }

  blocks.push(current.join("\n"));
  current.length = 0;
};
