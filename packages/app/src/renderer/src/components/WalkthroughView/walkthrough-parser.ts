export interface WalkthroughSection {
  id: string;
  markdown: string;
}

export interface WalkthroughHeading {
  id: string;
  level: number;
  text: string;
}

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