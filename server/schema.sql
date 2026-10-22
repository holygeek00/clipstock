CREATE TABLE IF NOT EXISTS cs_teams (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cs_users (
 id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cs_members (
 team_id TEXT REFERENCES cs_teams(id) ON DELETE CASCADE,
 user_id TEXT REFERENCES cs_users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
 PRIMARY KEY (team_id,user_id)
);
CREATE TABLE IF NOT EXISTS cs_workspaces (
 team_id TEXT PRIMARY KEY REFERENCES cs_teams(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by TEXT REFERENCES cs_users(id)
);
CREATE TABLE IF NOT EXISTS cs_snapshots (
 team_id TEXT REFERENCES cs_teams(id) ON DELETE CASCADE, revision INTEGER NOT NULL,
 data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 user_id TEXT REFERENCES cs_users(id), PRIMARY KEY(team_id,revision)
);
CREATE TABLE IF NOT EXISTS cs_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES cs_users(id) ON DELETE CASCADE,
 team_id TEXT REFERENCES cs_teams(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cs_sessions_expiry ON cs_sessions(expires_at);
CREATE TABLE IF NOT EXISTS cs_invites (
 token_hash TEXT PRIMARY KEY, team_id TEXT REFERENCES cs_teams(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
 created_by TEXT REFERENCES cs_users(id), expires_at TIMESTAMPTZ NOT NULL,
 used_by TEXT REFERENCES cs_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cs_rate_limits (
 key TEXT PRIMARY KEY, hits INTEGER NOT NULL, window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
