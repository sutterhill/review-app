interface Env {
  DB: D1Database;
  GITHUB_TOKEN?: string;
}

interface PrRow {
  id: number;
  owner: string;
  repo: string;
  number: number;
  metadata_json: string;
  diff_text: string;
  fetched_at: string;
}

interface NarrativeRow {
  id: number;
  pr_id: number;
  content: string;
  model: string;
  generated_at: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/api/pr") {
        return await cachePr(request, env);
      }

      const prMatch = url.pathname.match(/^\/api\/pr\/([0-9]+)$/);
      if (request.method === "GET" && prMatch) {
        return await getPr(env, Number(prMatch[1]));
      }

      const narrativeMatch = url.pathname.match(/^\/api\/narrative\/([0-9]+)$/);
      if (request.method === "GET" && narrativeMatch) {
        return await getNarrative(env, Number(narrativeMatch[1]));
      }

      if (request.method === "POST" && url.pathname === "/api/narrative") {
        return await storeNarrative(request, env);
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Internal server error";
      const status = error instanceof HttpError ? error.status : 500;
      return json({ error: message }, status);
    }
  },
};

async function cachePr(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const owner = requireString(body.owner, "owner");
  const repo = requireString(body.repo, "repo");
  const number = requireInteger(body.number, "number");
  const providedMetadata = body.metadata ?? body.metadataJson;
  const providedDiff = typeof body.diffText === "string" ? body.diffText : undefined;
  const fetchedAt = new Date().toISOString();

  const data =
    providedMetadata !== undefined && providedDiff !== undefined
      ? { metadata: providedMetadata, diffText: providedDiff }
      : await fetchGithubPr(owner, repo, number, request, env);

  await env.DB.prepare(
    `INSERT INTO prs (owner, repo, number, metadata_json, diff_text, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner, repo, number) DO UPDATE SET
       metadata_json = excluded.metadata_json,
       diff_text = excluded.diff_text,
       fetched_at = excluded.fetched_at`,
  )
    .bind(owner, repo, number, JSON.stringify(data.metadata), data.diffText, fetchedAt)
    .run();

  const row = await findPrByCoordinates(env, owner, repo, number);
  return json({ pr: serializePr(row) }, 201);
}

async function getPr(env: Env, id: number): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM prs WHERE id = ?").bind(id).first<PrRow>();
  if (!row) {
    throw new HttpError(404, "PR not found");
  }

  return json({ pr: serializePr(row) });
}

async function getNarrative(env: Env, prId: number): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT * FROM narratives
     WHERE pr_id = ?
     ORDER BY generated_at DESC, id DESC
     LIMIT 1`,
  )
    .bind(prId)
    .first<NarrativeRow>();

  if (!row) {
    throw new HttpError(404, "Narrative not found");
  }

  return json({ narrative: serializeNarrative(row) });
}

async function storeNarrative(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const prId = requireInteger(body.prId ?? body.pr_id, "prId");
  const content = requireString(body.content, "content");
  const model = requireString(body.model, "model");
  const generatedAt = new Date().toISOString();

  await ensurePrExists(env, prId);
  await env.DB.prepare(
    "INSERT INTO narratives (pr_id, content, model, generated_at) VALUES (?, ?, ?, ?)",
  )
    .bind(prId, content, model, generatedAt)
    .run();

  const row = await env.DB.prepare(
    "SELECT * FROM narratives WHERE pr_id = ? ORDER BY id DESC LIMIT 1",
  )
    .bind(prId)
    .first<NarrativeRow>();

  return json({ narrative: serializeNarrative(row) }, 201);
}

async function fetchGithubPr(
  owner: string,
  repo: string,
  number: number,
  request: Request,
  env: Env,
): Promise<{ metadata: unknown; diffText: string }> {
  const token =
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? env.GITHUB_TOKEN;
  const headers = githubHeaders(token);
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
  const [prResponse, filesResponse, diffResponse] = await Promise.all([
    fetch(baseUrl, { headers }),
    fetch(`${baseUrl}/files`, { headers }),
    fetch(baseUrl, { headers: { ...headers, Accept: "application/vnd.github.diff" } }),
  ]);

  if (!prResponse.ok || !filesResponse.ok || !diffResponse.ok) {
    throw new HttpError(502, "Failed to fetch PR from GitHub");
  }

  return {
    metadata: { pr: await prResponse.json(), files: await filesResponse.json() },
    diffText: await diffResponse.text(),
  };
}

function githubHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "review-app-worker",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function findPrByCoordinates(
  env: Env,
  owner: string,
  repo: string,
  number: number,
): Promise<PrRow> {
  const row = await env.DB.prepare("SELECT * FROM prs WHERE owner = ? AND repo = ? AND number = ?")
    .bind(owner, repo, number)
    .first<PrRow>();

  if (!row) {
    throw new HttpError(500, "Stored PR could not be loaded");
  }

  return row;
}

async function ensurePrExists(env: Env, prId: number): Promise<void> {
  const row = await env.DB.prepare("SELECT id FROM prs WHERE id = ?").bind(prId).first();
  if (!row) {
    throw new HttpError(404, "PR not found");
  }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Expected a JSON object");
    }

    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(400, "Invalid JSON body");
  }
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `Missing required field: ${name}`);
  }

  return value.trim();
}

function requireInteger(value: unknown, name: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new HttpError(400, `Missing required field: ${name}`);
  }

  return number;
}

function serializePr(row: PrRow) {
  return {
    id: row.id,
    owner: row.owner,
    repo: row.repo,
    number: row.number,
    metadata: JSON.parse(row.metadata_json) as unknown,
    diffText: row.diff_text,
    fetchedAt: row.fetched_at,
  };
}

function serializeNarrative(row: NarrativeRow | null) {
  if (!row) {
    throw new HttpError(500, "Stored narrative could not be loaded");
  }

  return {
    id: row.id,
    prId: row.pr_id,
    content: row.content,
    model: row.model,
    generatedAt: row.generated_at,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
