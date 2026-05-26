import { promises as fs } from "node:fs";
import path from "node:path";

import { app } from "electron";

const PR_REFERENCE_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#([0-9]+)$/u;

interface CommentsPathParts {
  number: string;
  owner: string;
  repo: string;
}

export type CommentsData = unknown[];

export const saveComments = async (prReference: string, threads: CommentsData): Promise<void> => {
  const target = getCommentsPath(prReference);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(threads, null, 2), "utf8");
};

export const loadComments = async (prReference: string): Promise<CommentsData> => {
  try {
    const content = await fs.readFile(getCommentsPath(prReference), "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    if (isEnoentError(error)) {
      return [];
    }
    throw error;
  }
};

const getCommentsPath = (prReference: string): string => {
  const { number, owner, repo } = parsePrReference(prReference);
  return path.join(app.getPath("userData"), "comments", owner, repo, `${number}.json`);
};

const parsePrReference = (prReference: string): CommentsPathParts => {
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
