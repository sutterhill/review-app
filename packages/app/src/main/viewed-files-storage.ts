import { promises as fs } from "node:fs";
import path from "node:path";

import { app } from "electron";

const PR_REFERENCE_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#([0-9]+)$/u;

interface ViewedFilesPathParts {
  number: string;
  owner: string;
  repo: string;
}

export type ViewedFilesData = string[];

export const saveViewedFiles = async (
  prReference: string,
  paths: ViewedFilesData,
): Promise<void> => {
  const target = getViewedFilesPath(prReference);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(paths, null, 2), "utf8");
};

export const loadViewedFiles = async (prReference: string): Promise<ViewedFilesData> => {
  try {
    const content = await fs.readFile(getViewedFilesPath(prReference), "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === "string");
    }
    return [];
  } catch (error) {
    if (isEnoentError(error)) {
      return [];
    }
    throw error;
  }
};

const getViewedFilesPath = (prReference: string): string => {
  const { number, owner, repo } = parsePrReference(prReference);
  return path.join(app.getPath("userData"), "viewed-files", owner, repo, `${number}.json`);
};

const parsePrReference = (prReference: string): ViewedFilesPathParts => {
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
