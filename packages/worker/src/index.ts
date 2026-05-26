interface Env {
  CORS_ORIGIN?: string;
  DB: D1Database;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  GITHUB_TOKEN?: string;
  REVIEW_APP_API_TOKEN?: string;
  REVIEW_APP_SESSION_SECRET?: string;
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

interface OAuthState {
  expiresAt: number;
  nonce: string;
  returnTo: string;
}

interface OAuthSession {
  expiresAt: number;
  githubToken: string;
}

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_OAUTH_SCOPE = "repo read:org";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/auth/github/start") {
        return await startGitHubOAuth(request, env);
      }

      if (request.method === "GET" && url.pathname === "/auth/github/callback") {
        return await finishGitHubOAuth(request, env);
      }

      if (request.method === "GET" && url.pathname === "/auth/session") {
        return withCors(await getOAuthSession(request, env), env);
      }

      if (url.pathname.startsWith("/api/")) {
        requireApiAuthorization(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/pr") {
        return withCors(await cachePr(request, env), env);
      }

      const prMatch = url.pathname.match(/^\/api\/pr\/([0-9]+)$/);
      if (request.method === "GET" && prMatch) {
        return withCors(await getPr(env, Number(prMatch[1])), env);
      }

      const narrativeMatch = url.pathname.match(/^\/api\/narrative\/([0-9]+)$/);
      if (request.method === "GET" && narrativeMatch) {
        return withCors(await getNarrative(env, Number(narrativeMatch[1])), env);
      }

      if (request.method === "POST" && url.pathname === "/api/narrative") {
        return withCors(await storeNarrative(request, env), env);
      }

      return withCors(json({ error: "Not found" }, 404), env);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Internal server error";
      const status = error instanceof HttpError ? error.status : 500;
      return withCors(json({ error: message }, status), env);
    }
  },
};

async function startGitHubOAuth(request: Request, env: Env): Promise<Response> {
  const clientId = requireEnv(env.GITHUB_OAUTH_CLIENT_ID, "GITHUB_OAUTH_CLIENT_ID");
  const returnTo = requireOAuthReturnTo(new URL(request.url).searchParams.get("return_to"), env);
  const state = await sealJson<OAuthState>(
    {
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
      nonce: crypto.randomUUID(),
      returnTo,
    },
    env,
  );
  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", getOAuthCallbackUrl(request));
  authorizeUrl.searchParams.set("scope", GITHUB_OAUTH_SCOPE);
  authorizeUrl.searchParams.set("state", state);

  return Response.redirect(authorizeUrl.toString(), 302);
}

async function finishGitHubOAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = requireString(url.searchParams.get("code"), "code");
  const state = await openJson<OAuthState>(
    requireString(url.searchParams.get("state"), "state"),
    env,
  );

  if (state.expiresAt < Date.now()) {
    throw new HttpError(400, "GitHub OAuth state expired");
  }

  const githubToken = await exchangeGitHubOAuthCode(code, getOAuthCallbackUrl(request), env);
  const session = await sealJson<OAuthSession>(
    {
      expiresAt: Date.now() + OAUTH_SESSION_TTL_MS,
      githubToken,
    },
    env,
  );
  const returnUrl = new URL(state.returnTo);
  returnUrl.searchParams.set("reviewAppSession", session);

  return Response.redirect(returnUrl.toString(), 302);
}

async function getOAuthSession(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/u);
  if (!match?.[1]) {
    throw new HttpError(401, "Unauthorized");
  }

  const session = await openJson<OAuthSession>(match[1], env);
  if (session.expiresAt < Date.now()) {
    throw new HttpError(401, "GitHub OAuth session expired");
  }

  return json({ githubToken: session.githubToken });
}

async function exchangeGitHubOAuthCode(
  code: string,
  redirectUri: string,
  env: Env,
): Promise<string> {
  const clientId = requireEnv(env.GITHUB_OAUTH_CLIENT_ID, "GITHUB_OAUTH_CLIENT_ID");
  const clientSecret = requireEnv(env.GITHUB_OAUTH_CLIENT_SECRET, "GITHUB_OAUTH_CLIENT_SECRET");
  const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const body = (await response.json()) as { access_token?: unknown; error_description?: unknown };
  if (!response.ok || typeof body.access_token !== "string" || body.access_token.length === 0) {
    throw new HttpError(
      502,
      typeof body.error_description === "string"
        ? body.error_description
        : "GitHub OAuth token exchange failed",
    );
  }

  return body.access_token;
}

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
  const token = request.headers.get("X-GitHub-Token")?.trim() || env.GITHUB_TOKEN;
  const headers = githubHeaders(token);
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo,
  )}/pulls/${encodeURIComponent(String(number))}`;
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

function requireEnv(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new HttpError(500, `${name} is not configured`);
  }

  return value.trim();
}

function requireOAuthReturnTo(value: string | null, env: Env): string {
  const fallback = requireEnv(env.CORS_ORIGIN, "CORS_ORIGIN");
  const returnTo = value?.trim() || fallback;
  const origin = new URL(fallback).origin;
  const url = new URL(returnTo);

  if (url.origin !== origin) {
    throw new HttpError(400, "Invalid OAuth return URL");
  }

  return url.toString();
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

function requireApiAuthorization(request: Request, env: Env): void {
  const expectedToken = env.REVIEW_APP_API_TOKEN?.trim();
  if (!expectedToken) {
    throw new HttpError(500, "Worker API auth token is not configured");
  }

  const authorization = request.headers.get("Authorization") ?? "";
  if (authorization !== `Bearer ${expectedToken}`) {
    throw new HttpError(401, "Unauthorized");
  }
}

function corsHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-GitHub-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };

  const origin = env.CORS_ORIGIN?.trim();
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function getOAuthCallbackUrl(request: Request): string {
  const url = new URL(request.url);
  url.pathname = "/auth/github/callback";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function sealJson<Value>(value: Value, env: Env): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ iv, name: "AES-GCM" }, await getSessionKey(env), encoded),
  );
  return `${base64UrlEncode(iv)}.${base64UrlEncode(encrypted)}`;
}

async function openJson<Value>(sealed: string, env: Env): Promise<Value> {
  const [encodedIv, encodedEncrypted, ...extra] = sealed.split(".");
  if (!encodedIv || !encodedEncrypted || extra.length > 0) {
    throw new HttpError(400, "Invalid sealed session");
  }

  try {
    const iv = base64UrlDecode(encodedIv);
    const encrypted = base64UrlDecode(encodedEncrypted);
    const decrypted = await crypto.subtle.decrypt(
      { iv, name: "AES-GCM" },
      await getSessionKey(env),
      encrypted,
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as Value;
  } catch {
    throw new HttpError(400, "Invalid sealed session");
  }
}

async function getSessionKey(env: Env): Promise<CryptoKey> {
  const secret = requireEnv(env.REVIEW_APP_SESSION_SECRET, "REVIEW_APP_SESSION_SECRET");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt", "encrypt"]);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function withCors(response: Response, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(env))) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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
