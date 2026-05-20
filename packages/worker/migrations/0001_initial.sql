CREATE TABLE IF NOT EXISTS prs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  number INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  diff_text TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner, repo, number)
);

CREATE INDEX IF NOT EXISTS idx_prs_owner_repo_number
  ON prs(owner, repo, number);

CREATE TABLE IF NOT EXISTS narratives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (pr_id) REFERENCES prs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_narratives_pr_generated
  ON narratives(pr_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  pr_id INTEGER NOT NULL,
  user TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (pr_id) REFERENCES prs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_pr_id ON sessions(pr_id);