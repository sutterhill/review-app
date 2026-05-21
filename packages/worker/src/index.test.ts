import { describe, expect, it } from "vitest";

import worker from "./index";

const API_TOKEN = "test-token";

interface PrRow {
  diff_text: string;
  fetched_at: string;
  id: number;
  metadata_json: string;
  number: number;
  owner: string;
  repo: string;
}

interface NarrativeRow {
  content: string;
  generated_at: string;
  id: number;
  model: string;
  pr_id: number;
}

interface MockState {
  narratives: NarrativeRow[];
  nextNarrativeId: number;
  nextPrId: number;
  prs: PrRow[];
}

type WorkerEnv = Parameters<typeof worker.fetch>[1];

describe("worker API endpoints", () => {
  it("caches and retrieves pull requests", async () => {
    const env = createEnv();
    const postResponse = await worker.fetch(
      jsonRequest("POST", "/api/pr", {
        diffText: "diff --git a/src/app.ts b/src/app.ts",
        metadata: { title: "Add app value" },
        number: 7,
        owner: "acme",
        repo: "repo",
      }),
      env,
    );
    const postBody = (await postResponse.json()) as { pr: { id: number; metadata: unknown } };

    expect(postResponse.status).toBe(201);
    expect(postBody.pr).toMatchObject({ id: 1, metadata: { title: "Add app value" } });

    const getResponse = await worker.fetch(apiRequest("GET", `/api/pr/${postBody.pr.id}`), env);

    await expect(getResponse.json()).resolves.toMatchObject({
      pr: { diffText: "diff --git a/src/app.ts b/src/app.ts", id: 1, number: 7 },
    });
    expect(getResponse.status).toBe(200);
  });

  it("returns pull request endpoint errors", async () => {
    const env = createEnv();

    const invalidPost = await worker.fetch(jsonRequest("POST", "/api/pr", { owner: "acme" }), env);
    const missingGet = await worker.fetch(apiRequest("GET", "/api/pr/404"), env);

    expect(invalidPost.status).toBe(400);
    await expect(invalidPost.json()).resolves.toEqual({ error: "Missing required field: repo" });
    expect(missingGet.status).toBe(404);
    await expect(missingGet.json()).resolves.toEqual({ error: "PR not found" });
  });

  it("stores and retrieves narratives", async () => {
    const env = createEnv();
    await seedPr(env);

    const postResponse = await worker.fetch(
      jsonRequest("POST", "/api/narrative", {
        content: "This PR adds the app value.",
        model: "pi-agent",
        prId: 1,
      }),
      env,
    );

    expect(postResponse.status).toBe(201);
    await expect(postResponse.json()).resolves.toMatchObject({
      narrative: { content: "This PR adds the app value.", id: 1, model: "pi-agent", prId: 1 },
    });

    const getResponse = await worker.fetch(apiRequest("GET", "/api/narrative/1"), env);

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      narrative: { content: "This PR adds the app value.", id: 1, prId: 1 },
    });
  });

  it("returns narrative endpoint errors", async () => {
    const env = createEnv();

    const invalidPost = await worker.fetch(
      jsonRequest("POST", "/api/narrative", { content: "Missing PR", model: "pi-agent", prId: 99 }),
      env,
    );
    const missingGet = await worker.fetch(apiRequest("GET", "/api/narrative/99"), env);

    expect(invalidPost.status).toBe(404);
    await expect(invalidPost.json()).resolves.toEqual({ error: "PR not found" });
    expect(missingGet.status).toBe(404);
    await expect(missingGet.json()).resolves.toEqual({ error: "Narrative not found" });
  });
});

const createEnv = (): WorkerEnv =>
  ({
    CORS_ORIGIN: "http://localhost",
    DB: createMockDb(),
    REVIEW_APP_API_TOKEN: API_TOKEN,
  }) as WorkerEnv;

const seedPr = async (env: WorkerEnv): Promise<void> => {
  await worker.fetch(
    jsonRequest("POST", "/api/pr", {
      diffText: "diff",
      metadata: { title: "Seed PR" },
      number: 1,
      owner: "acme",
      repo: "repo",
    }),
    env,
  );
};

const apiRequest = (method: string, path: string): Request =>
  new Request(`https://worker.test${path}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    method,
  });

const jsonRequest = (method: string, path: string, body: unknown): Request =>
  new Request(`https://worker.test${path}`, {
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    method,
  });

const createMockDb = (): D1Database => {
  const state: MockState = { narratives: [], nextNarrativeId: 1, nextPrId: 1, prs: [] };
  return {
    prepare: (sql: string) => new MockStatement(sql, state) as unknown as D1PreparedStatement,
  } as D1Database;
};

class MockStatement {
  private bindings: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly state: MockState,
  ) {}

  bind(...bindings: unknown[]): D1PreparedStatement {
    this.bindings = bindings;
    return this as unknown as D1PreparedStatement;
  }

  async run(): Promise<D1Result> {
    if (this.sql.includes("INSERT INTO prs")) {
      const [owner, repo, number, metadataJson, diffText, fetchedAt] = this.bindings;
      const existing = this.state.prs.find(
        (row) => row.owner === owner && row.repo === repo && row.number === number,
      );
      const row = existing ?? {
        id: this.state.nextPrId++,
        owner: owner as string,
        repo: repo as string,
        number: number as number,
        metadata_json: "{}",
        diff_text: "",
        fetched_at: "",
      };
      Object.assign(row, {
        diff_text: diffText,
        fetched_at: fetchedAt,
        metadata_json: metadataJson,
      });
      if (!existing) {
        this.state.prs.push(row);
      }
    }

    if (this.sql.includes("INSERT INTO narratives")) {
      const [prId, content, model, generatedAt] = this.bindings;
      this.state.narratives.push({
        content: content as string,
        generated_at: generatedAt as string,
        id: this.state.nextNarrativeId++,
        model: model as string,
        pr_id: prId as number,
      });
    }

    return { success: true } as D1Result;
  }

  async first<T = unknown>(): Promise<T | null> {
    if (this.sql.includes("FROM prs WHERE owner = ?")) {
      const [owner, repo, number] = this.bindings;
      return this.state.prs.find(
        (row) => row.owner === owner && row.repo === repo && row.number === number,
      ) as T;
    }

    if (this.sql.includes("FROM prs WHERE id = ?")) {
      const [id] = this.bindings;
      const row = this.state.prs.find((pr) => pr.id === id);
      return (this.sql.includes("SELECT id") && row ? { id: row.id } : (row ?? null)) as T | null;
    }

    if (this.sql.includes("FROM narratives")) {
      const [prId] = this.bindings;
      return ([...this.state.narratives].reverse().find((row) => row.pr_id === prId) ??
        null) as T | null;
    }

    return null;
  }
}
