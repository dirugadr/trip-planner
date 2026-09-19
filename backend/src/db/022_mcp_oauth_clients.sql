-- HU-12.4 — Dynamic Client Registration (RFC 7591) for the MCP OAuth server.
-- ChatGPT registers itself instead of using a pre-shared client id. Every
-- dynamic client is a public client (PKCE, no secret) whose redirect URIs were
-- checked against a server-side allowlist at registration time, so only
-- (client_id, redirect_uris, name) need to be kept. Claude's fixed client is
-- unchanged and lives in config, not here.
-- Timestamps are ISO-8601 UTC strings.
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT,
  redirect_uris TEXT NOT NULL, -- JSON array of exact redirect URIs
  created_at TEXT NOT NULL
);
