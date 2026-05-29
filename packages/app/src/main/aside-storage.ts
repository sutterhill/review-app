import { promises as fs } from "node:fs";
import path from "node:path";

import { app } from "electron";

export type AsideData = string[];

const getAsidePath = (): string => path.join(app.getPath("userData"), "aside-prs.json");

export const saveAside = async (references: AsideData): Promise<void> => {
  const target = getAsidePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(references, null, 2), "utf8");
};

export const loadAside = async (): Promise<AsideData> => {
  try {
    const content = await fs.readFile(getAsidePath(), "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === "string");
    }
    return [];
  } catch {
    return [];
  }
};
