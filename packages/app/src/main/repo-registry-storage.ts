import { promises as fs } from "node:fs";
import path from "node:path";

import { app } from "electron";

export interface RepoRegistryData {
  [normalizedKey: string]: { fullName: string; localPath: string };
}

const getRegistryPath = (): string => path.join(app.getPath("userData"), "repo-registry.json");

export const saveRepoRegistry = async (entries: RepoRegistryData): Promise<void> => {
  const registryPath = getRegistryPath();
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, JSON.stringify(entries, null, 2), "utf8");
};

export const loadRepoRegistry = async (): Promise<RepoRegistryData> => {
  try {
    const content = await fs.readFile(getRegistryPath(), "utf8");
    return JSON.parse(content) as RepoRegistryData;
  } catch {
    return {};
  }
};