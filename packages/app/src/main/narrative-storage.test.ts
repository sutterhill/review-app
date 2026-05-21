import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getPath } = vi.hoisted(() => ({
  getPath: vi.fn<(name: string) => string>(),
}));

vi.mock("electron", () => ({
  app: { getPath },
}));

import { loadNarrative, saveNarrative } from "./narrative-storage";

let userDataPath = "";

describe("narrative storage", () => {
  beforeEach(async () => {
    userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "review-app-narrative-"));
    getPath.mockReturnValue(userDataPath);
  });

  afterEach(async () => {
    await fs.rm(userDataPath, { force: true, recursive: true });
    getPath.mockReset();
  });

  it("saves and loads narratives by PR reference", async () => {
    await saveNarrative("acme/repo#42", "Narrative content");

    await expect(loadNarrative("acme/repo#42")).resolves.toBe("Narrative content");
    await expect(
      fs.readFile(path.join(userDataPath, "narratives", "acme", "repo", "42.md"), "utf8"),
    ).resolves.toBe("Narrative content");
  });

  it("returns null when a narrative has not been saved", async () => {
    await expect(loadNarrative("acme/repo#42")).resolves.toBeNull();
  });

  it("rejects invalid PR references", async () => {
    await expect(saveNarrative("acme/repo", "content")).rejects.toThrow(
      "PR reference must use owner/repo#number format.",
    );
  });
});
