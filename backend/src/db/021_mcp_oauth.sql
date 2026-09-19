-- Épica 12 (MCP remoto) — OAuth 2.1 authorization server for Claude.
-- Codes and tokens are stored only as SHA-256 hashes (they're high-entropy
-- random values, so a plain hash is enough): a DB leak can't be replayed.
-- Timestamps are ISO-8601 UTC strings, compared lexicographically.

-- One-time authorization codes (PKCE-bound), short-lived.
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  redirect_uri TEXT NOT NULL,
  resource TEXT,
  scope TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

-- Access tokens presented to the MCP endpoint.
CREATE TABLE IF NOT EXISTS mcp_access_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  scope TEXT NOT NULL,
  resource TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_email ON mcp_access_tokens(user_email);

-- Refresh tokens: single-use, rotated on every refresh (public client).
CREATE TABLE IF NOT EXISTS mcp_refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  scope TEXT NOT NULL,
  resource TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_refresh_tokens_email ON mcp_refresh_tokens(user_email);
