export type TableAlign = "center" | "left" | "right" | null;

export type Block =
  | { content: string; lang: null | string; type: "code" }
  | { items: string[]; ordered: boolean; type: "list" }
  | { align: TableAlign[]; header: string[]; rows: string[][]; type: "table" }
  | { text: string; type: "paragraph" };

const FENCE_PATTERN = /^```(\S*)\s*$/u;
const UL_PATTERN = /^[-*]\s+(.*)$/u;
const OL_PATTERN = /^\d+\.\s+(.*)$/u;
const TABLE_DIVIDER_CELL = /^\s*:?-{2,}:?\s*$/u;

export const parseBlocks = (body: string): Block[] => {
  const lines = body.split(/\r?\n/u);
  const blocks: Block[] = [];
  let index = 0;

  const flushParagraph = (buffer: string[]): void => {
    if (buffer.length === 0) return;
    blocks.push({ text: buffer.join(" ").trim(), type: "paragraph" });
    buffer.length = 0;
  };

  const paragraphBuffer: string[] = [];

  while (index < lines.length) {
    const line = lines[index] ?? "";

    const fenceMatch = FENCE_PATTERN.exec(line);
    if (fenceMatch) {
      flushParagraph(paragraphBuffer);
      const lang = fenceMatch[1] ? fenceMatch[1] : null;
      const content: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE_PATTERN.test(lines[index] ?? "")) {
        content.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ content: content.join("\n"), lang, type: "code" });
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph(paragraphBuffer);
      index += 1;
      continue;
    }

    const table = tryParseTable(lines, index);
    if (table) {
      flushParagraph(paragraphBuffer);
      blocks.push(table.block);
      index = table.nextIndex;
      continue;
    }

    const ulMatch = UL_PATTERN.exec(line);
    const olMatch = OL_PATTERN.exec(line);
    if (ulMatch || olMatch) {
      flushParagraph(paragraphBuffer);
      const ordered = !ulMatch;
      const pattern = ordered ? OL_PATTERN : UL_PATTERN;
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = lines[index] ?? "";
        const itemMatch = pattern.exec(itemLine);
        if (itemMatch) {
          items.push(itemMatch[1] ?? "");
          index += 1;
          continue;
        }
        if (/^\s+\S/u.test(itemLine) && items.length > 0) {
          items[items.length - 1] = `${items[items.length - 1]} ${itemLine.trim()}`;
          index += 1;
          continue;
        }
        break;
      }
      blocks.push({ items, ordered, type: "list" });
      continue;
    }

    paragraphBuffer.push(line.trim());
    index += 1;
  }

  flushParagraph(paragraphBuffer);
  return blocks;
};

interface TableParseResult {
  block: Extract<Block, { type: "table" }>;
  nextIndex: number;
}

const tryParseTable = (lines: string[], start: number): TableParseResult | null => {
  const headerLine = lines[start] ?? "";
  const dividerLine = lines[start + 1] ?? "";
  if (!headerLine.includes("|") || !dividerLine.includes("|")) return null;
  const headerCells = splitTableRow(headerLine);
  const dividerCells = splitTableRow(dividerLine);
  if (headerCells.length === 0 || headerCells.length !== dividerCells.length) return null;
  if (!dividerCells.every((cell) => TABLE_DIVIDER_CELL.test(cell))) return null;

  const align: TableAlign[] = dividerCells.map((cell) => {
    const trimmed = cell.trim();
    const left = trimmed.startsWith(":");
    const right = trimmed.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });

  const rows: string[][] = [];
  let cursor = start + 2;
  while (cursor < lines.length) {
    const row = lines[cursor] ?? "";
    if (!row.includes("|") || row.trim().length === 0) break;
    const cells = splitTableRow(row);
    if (cells.length === 0) break;
    while (cells.length < headerCells.length) cells.push("");
    if (cells.length > headerCells.length) cells.length = headerCells.length;
    rows.push(cells);
    cursor += 1;
  }

  return {
    block: { align, header: headerCells, rows, type: "table" },
    nextIndex: cursor,
  };
};

const splitTableRow = (line: string): string[] => {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
};
