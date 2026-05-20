import type { PullRequestFile, PullRequestFileStatus } from "../../store/pr/pr-types";

export interface ParsedDiffFile {
  additions: number;
  changes: number;
  deletions: number;
  patch: string;
  path: string;
  previousPath?: string;
  status: PullRequestFileStatus;
}

interface PatchChunk {
  newPath: string;
  oldPath: string;
  patch: string;
  status: PullRequestFileStatus;
}

export const parseUnifiedDiff = (diff: string, files: PullRequestFile[]): ParsedDiffFile[] => {
  const chunks = parsePatchChunks(diff);
  const chunksByPath = new Map<string, PatchChunk>();

  for (const chunk of chunks) {
    chunksByPath.set(chunk.newPath, chunk);
    chunksByPath.set(chunk.oldPath, chunk);
  }

  const parsedFiles = files.map((file) => {
    const chunk = chunksByPath.get(file.filename) ?? chunksByPath.get(file.previousFilename ?? "");
    return toParsedDiffFile(file, chunk?.patch ?? createFallbackPatch(file));
  });

  if (parsedFiles.length > 0) {
    return parsedFiles;
  }

  return chunks.map((chunk) => ({
    additions: countPatchLines(chunk.patch, "+"),
    changes: countPatchLines(chunk.patch, "+") + countPatchLines(chunk.patch, "-"),
    deletions: countPatchLines(chunk.patch, "-"),
    patch: chunk.patch,
    path: chunk.newPath,
    previousPath: chunk.oldPath === chunk.newPath ? undefined : chunk.oldPath,
    status: chunk.status,
  }));
};

const parsePatchChunks = (diff: string): PatchChunk[] =>
  diff
    .replaceAll("\r\n", "\n")
    .split(/(?=^diff --git )/mu)
    .map((patch) => patch.trimEnd())
    .filter((patch) => patch.startsWith("diff --git "))
    .map((patch) => {
      const { newPath, oldPath } = parseDiffHeader(patch);
      return { newPath, oldPath, patch, status: inferStatus(patch) };
    });

const parseDiffHeader = (patch: string): Pick<PatchChunk, "newPath" | "oldPath"> => {
  const header = patch.split("\n", 1)[0] ?? "";
  const match = header.match(/^diff --git a\/(.+) b\/(.+)$/u);

  return {
    newPath: match?.[2] ?? "unknown",
    oldPath: match?.[1] ?? match?.[2] ?? "unknown",
  };
};

const inferStatus = (patch: string): PullRequestFileStatus => {
  if (patch.includes("\nnew file mode ")) {
    return "added";
  }

  if (patch.includes("\ndeleted file mode ")) {
    return "deleted";
  }

  if (patch.includes("\nrename from ")) {
    return "renamed";
  }

  return "modified";
};

const toParsedDiffFile = (file: PullRequestFile, patch: string): ParsedDiffFile => ({
  additions: file.additions,
  changes: file.changes,
  deletions: file.deletions,
  patch,
  path: file.filename,
  previousPath: file.previousFilename,
  status: file.status,
});

const createFallbackPatch = (file: PullRequestFile): string => {
  if (file.patch.trim().length === 0) {
    return "";
  }

  const oldPath = file.previousFilename ?? file.filename;
  const oldHeader = file.status === "added" ? "--- /dev/null" : `--- a/${oldPath}`;
  const newHeader = file.status === "deleted" ? "+++ /dev/null" : `+++ b/${file.filename}`;

  return [`diff --git a/${oldPath} b/${file.filename}`, oldHeader, newHeader, file.patch].join(
    "\n",
  );
};

const countPatchLines = (patch: string, prefix: "+" | "-"): number =>
  patch
    .split("\n")
    .filter((line) => line.startsWith(prefix) && !line.startsWith(`${prefix}${prefix}${prefix}`))
    .length;
