import type { ParsedDiffFile } from "../DiffView";

export interface NarrativeSection {
  filePaths: string[];
  id: string;
  isFallback: boolean;
  markdown: string;
}

interface FileMatcher {
  aliases: string[];
  order: number;
  path: string;
}

interface ChangedLines {
  added: string[];
  deleted: string[];
}

export const buildNarrativeSections = (
  narrative: string,
  files: ParsedDiffFile[],
): NarrativeSection[] => {
  const matchers = createFileMatchers(files);
  const renderedPaths = new Set<string>();
  const sections = splitNarrativeBlocks(narrative).map((markdown, index) => {
    const filePaths = findReferencedPaths(markdown, matchers).filter((path) => {
      if (renderedPaths.has(path)) {
        return false;
      }

      renderedPaths.add(path);
      return true;
    });

    return { filePaths, id: `narrative-${index}`, isFallback: false, markdown };
  });

  const unreferencedPaths = files
    .map((file) => file.path)
    .filter((path) => !renderedPaths.has(path));

  if (unreferencedPaths.length > 0) {
    sections.push({
      filePaths: unreferencedPaths,
      id: "narrative-unreferenced-files",
      isFallback: true,
      markdown: sections.length > 0 ? "### Other changed files" : "### Changed files",
    });
  }

  return sections;
};

export const shouldCollapseDiffSection = (file: ParsedDiffFile): boolean =>
  isFormattingOnlyPatch(file.patch);

export const isFormattingOnlyPatch = (patch: string): boolean => {
  const { added, deleted } = getChangedLines(patch);

  if (added.length === 0 && deleted.length === 0) {
    return false;
  }

  const normalizedAdded = added.map(normalizeChangedLine).filter(Boolean);
  const normalizedDeleted = deleted.map(normalizeChangedLine).filter(Boolean);

  if (normalizedAdded.length === 0 && normalizedDeleted.length === 0) {
    return true;
  }

  if (sameSequence(normalizedAdded, normalizedDeleted)) {
    return true;
  }

  const changedLines = [...normalizedAdded, ...normalizedDeleted];
  return changedLines.every(isImportLike) && sameMultiset(normalizedAdded, normalizedDeleted);
};

const splitNarrativeBlocks = (narrative: string): string[] => {
  const blocks: string[] = [];
  const current: string[] = [];
  let isCodeFence = false;

  for (const line of narrative.replaceAll("\r\n", "\n").trim().split("\n")) {
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

const createFileMatchers = (files: ParsedDiffFile[]): FileMatcher[] => {
  const basenameCounts = new Map<string, number>();

  files.forEach((file) => {
    const basename = getBasename(file.path);
    basenameCounts.set(basename, (basenameCounts.get(basename) ?? 0) + 1);
  });

  return files.map((file, order) => {
    const aliases = [file.path, file.previousPath, getBasename(file.path)]
      .filter((alias): alias is string => Boolean(alias))
      .filter((alias, index, allAliases) => allAliases.indexOf(alias) === index)
      .filter((alias) => alias.includes("/") || basenameCounts.get(alias) === 1);

    return { aliases, order, path: file.path };
  });
};

const findReferencedPaths = (markdown: string, matchers: FileMatcher[]): string[] => {
  const references = matchers.flatMap((matcher) => {
    const indexes = matcher.aliases
      .map((alias) => findReferenceIndex(markdown, alias))
      .filter((index) => index >= 0);
    const firstIndex = Math.min(...indexes);

    return Number.isFinite(firstIndex)
      ? [{ index: firstIndex, order: matcher.order, path: matcher.path }]
      : [];
  });

  return references
    .sort((left, right) => left.index - right.index || left.order - right.order)
    .map((reference) => reference.path);
};

const findReferenceIndex = (markdown: string, alias: string): number => {
  const escapedAlias = escapeRegExp(alias);
  const pattern = new RegExp(`(^|[\\s\`"'([{<])(${escapedAlias})(?=$|[\\s\`"',.)\\]}>:;])`, "u");
  const match = markdown.match(pattern);

  return match ? (match.index ?? -1) : -1;
};

const getChangedLines = (patch: string): ChangedLines => {
  const changedLines: ChangedLines = { added: [], deleted: [] };

  patch.split("\n").forEach((line) => {
    if (line.startsWith("+++") || line.startsWith("---")) {
      return;
    }

    if (line.startsWith("+")) {
      changedLines.added.push(line.slice(1));
    } else if (line.startsWith("-")) {
      changedLines.deleted.push(line.slice(1));
    }
  });

  return changedLines;
};

const normalizeChangedLine = (line: string): string => line.trim().replaceAll(/\s+/gu, " ");

const isImportLike = (line: string): boolean =>
  /^import\s/u.test(line) || /^export\s+(?:type\s+)?[{*]/u.test(line);

const sameSequence = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const sameMultiset = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const counts = new Map<string, number>();
  left.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  for (const value of right) {
    const count = counts.get(value) ?? 0;
    if (count === 0) {
      return false;
    }

    counts.set(value, count - 1);
  }

  return true;
};

const getBasename = (path: string): string => path.split("/").at(-1) ?? path;

const escapeRegExp = (value: string): string => value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
