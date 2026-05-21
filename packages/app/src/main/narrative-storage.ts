import { promises as fs } from "node:fs";
import path from "node:path";

import { app } from "electron";

const PR_REFERENCE_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#([0-9]+)$/u;

interface NarrativePathParts {
  number: string;
  owner: string;
  repo: string;
}

export const saveNarrative = async (prReference: string, content: string): Promise<void> => {
  const narrativePath = getNarrativePath(prReference);
  await fs.mkdir(path.dirname(narrativePath), { recursive: true });
  await fs.writeFile(narrativePath, content, "utf8");
};

export const loadNarrative = async (prReference: string): Promise<string | null> => {
  try {
    return await fs.readFile(getNarrativePath(prReference), "utf8");
  } catch (error) {
    if (isEnoentError(error)) {
      return null;
    }

    throw error;
  }
};

const getNarrativePath = (prReference: string): string => {
  const { number, owner, repo } = parsePrReference(prReference);
  return path.join(app.getPath("userData"), "narratives", owner, repo, `${number}.md`);
};

const parsePrReference = (prReference: string): NarrativePathParts => {
  const match = PR_REFERENCE_PATTERN.exec(prReference);
  const owner = match?.at(1);
  const repo = match?.at(2);
  const number = match?.at(3);

  if (!owner || !repo || !number || !isSafePathSegment(owner) || !isSafePathSegment(repo)) {
    throw new Error("PR reference must use owner/repo#number format.");
  }

  return { number, owner, repo };
};

const isSafePathSegment = (segment: string): boolean => segment !== "." && segment !== "..";

const isEnoentError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
