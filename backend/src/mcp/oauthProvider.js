import crypto from 'crypto';
import config from '../config/index.js';
import { dbGet, dbRun, dbBatch } from '../db/database.js';
import { isEmailAllowed } from '../lib/auth.js';
import { redirectUriMatches } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import {
  InvalidRequestError,
  InvalidGrantError,
  InvalidTokenError,
  InvalidScopeError,
  InvalidTargetError
} from '@modelcontextprotocol/sdk/server/auth/errors.js';

// The only capability today is read-only access (HU-12.2). A future write
// scope (HU-12.3) would be a separate scope, never implied by this one.
export const MCP_SCOPE = 'mcp:read';
// `offline_access` is accepted because Claude appends it to ask for a refresh
// token — we always issue one, so it grants nothing extra.
const ACCEPTED_SCOPES = new Set([MCP_SCOPE, 'offline_access']);

const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;

const CODE_CHALLENGE_RE = /^[A-Za-z0-9_-]{43,128}$/;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const nowIso = () => new Date().toISOString();
const trimSlash = (url) => url.replace(/\/+$/, '');

export const mcpIssuerUrl = () => config.mcp.publicUrl;
export const mcpResourceUrl = () => `${config.mcp.publicUrl}/mcp`;
export const consentPageUrl = () => `${config.mcp.publicUrl}/autorizar-claude`;

// ── Fixed client (no dynamic registration) ──────────────────────
// Claude is a public client: PKCE instead of a secret. There's deliberately
// no registerClient(), so the SDK never mounts a /register endpoint.
export const clientsStore = {
  async getClient(clientId) {
    if (clientId !== config.mcp.clientId) return undefined;
    return {
      client_id: config.mcp.clientId,
      client_name: 'Claude',
      redirect_uris: config.mcp.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code']
    };
  }
};

/**
 * Validates an authorization request. Used twice on purpose: by the SDK's
 * /oauth/authorize (via provider.authorize) and again when the consent page
 * posts the same parameters back — they travel through the browser, so the
 * server never trusts them without re-checking.
 *
 * @returns {{ client, redirectUri:string, codeChallenge:string, resource:string }}
 */
export async function validateAuthorizeRequest({ client_id, redirect_uri, code_challenge, scope, resource }) {
  const client = await clientsStore.getClient(client_id);
  if (!client) throw new InvalidRequestError('client_id desconocido');

  if (!redirect_uri || !client.redirect_uris.some((registered) => redirectUriMatches(redirect_uri, registered))) {
    throw new InvalidRequestError('redirect_uri no registrado');
  }
  if (typeof code_challenge !== 'string' || !CODE_CHALLENGE_RE.test(code_challenge)) {
    throw new InvalidRequestError('code_challenge inválido (se requiere PKCE S256)');
  }

  const requested = (typeof scope === 'string' ? scope : '').split(' ').filter(Boolean);
  if (requested.some((s) => !ACCEPTED_SCOPES.has(s))) {
    throw new InvalidScopeError('Scope no soportado');
  }

  if (resource && trimSlash(resource) !== mcpResourceUrl()) {
    throw new InvalidTargetError('resource no corresponde a este servidor MCP');
  }

  return { client, redirectUri: redirect_uri, codeChallenge: code_challenge, resource: mcpResourceUrl() };
}

/** Persists a single-use authorization code (only its hash) and returns the raw code. */
export async function issueAuthorizationCode({ clientId, email, codeChallenge, redirectUri, resource }) {
  const code = randomToken();
  const now = Date.now();
  await dbBatch([
    {
      sql: `INSERT INTO oauth_authorization_codes
              (code_hash, client_id, user_email, code_challenge, code_challenge_method,
               redirect_uri, resource, scope, expires_at, created_at)
            VALUES (?, ?, ?, ?, 'S256', ?, ?, ?, ?, ?)`,
      args: [
        sha256(code), clientId, email, codeChallenge, redirectUri, resource, MCP_SCOPE,
        new Date(now + CODE_TTL_MS).toISOString(), new Date(now).toISOString()
      ]
    },
    {
      // Housekeeping: spent/expired codes have no use past a grace period.
      sql: 'DELETE FROM oauth_authorization_codes WHERE expires_at < ?',
      args: [new Date(now - CLEANUP_GRACE_MS).toISOString()]
    }
  ]);
  return code;
}

async function issueTokenPair({ clientId, email, scope, resource }) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = Date.now();
  const created = new Date(now).toISOString();
  const cutoff = new Date(now - CLEANUP_GRACE_MS).toISOString();

  await dbBatch([
    {
      sql: `INSERT INTO mcp_access_tokens (token_hash, client_id, user_email, scope, resource, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [sha256(accessToken), clientId, email, scope, resource, new Date(now + ACCESS_TTL_S * 1000).toISOString(), created]
    },
    {
      sql: `INSERT INTO mcp_refresh_tokens (token_hash, client_id, user_email, scope, resource, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [sha256(refreshToken), clientId, email, scope, resource, new Date(now + REFRESH_TTL_MS).toISOString(), created]
    },
    { sql: 'DELETE FROM mcp_access_tokens WHERE expires_at < ?', args: [cutoff] },
    { sql: 'DELETE FROM mcp_refresh_tokens WHERE expires_at < ?', args: [cutoff] }
  ]);

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_S,
    refresh_token: refreshToken,
    scope
  };
}

async function loadUsableCode(client, code) {
  const row = await dbGet('SELECT * FROM oauth_authorization_codes WHERE code_hash = ?', [sha256(code)]);
  if (!row || row.client_id !== client.client_id || row.used_at || row.expires_at <= nowIso()) {
    throw new InvalidGrantError('Código de autorización inválido, vencido o ya usado');
  }
  return row;
}

/** @type {import('@modelcontextprotocol/sdk/server/auth/provider.js').OAuthServerProvider} */
export const oauthProvider = {
  clientsStore,

  // Called by the SDK's authorize handler after it validated client_id,
  // redirect_uri and PKCE method. We re-validate the rest and hand the browser
  // to the consent page, which does the Google sign-in.
  async authorize(client, params, res) {
    const { redirectUri, codeChallenge } = await validateAuthorizeRequest({
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      scope: (params.scopes || []).join(' '),
      resource: params.resource?.href
    });

    const url = new URL(consentPageUrl());
    url.searchParams.set('client_id', client.client_id);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code_challenge', codeChallenge);
    if (params.state) url.searchParams.set('state', params.state);
    if (params.scopes?.length) url.searchParams.set('scope', params.scopes.join(' '));
    if (params.resource) url.searchParams.set('resource', params.resource.href);
    res.redirect(302, url.href);
  },

  // The SDK verifies the PKCE verifier against this challenge BEFORE calling
  // exchangeAuthorizationCode, which is where the code is actually consumed.
  async challengeForAuthorizationCode(client, authorizationCode) {
    const row = await loadUsableCode(client, authorizationCode);
    return row.code_challenge;
  },

  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri, resource) {
    const row = await loadUsableCode(client, authorizationCode);

    if (redirectUri !== row.redirect_uri) {
      throw new InvalidGrantError('redirect_uri no coincide con el de la autorización');
    }
    if (resource && trimSlash(resource.href) !== row.resource) {
      throw new InvalidTargetError('resource no coincide con el de la autorización');
    }

    // Atomic single-use: of two concurrent exchanges of the same code, only
    // one UPDATE matches used_at IS NULL.
    const now = nowIso();
    const consumed = await dbRun(
      `UPDATE oauth_authorization_codes SET used_at = ?
        WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?`,
      [now, sha256(authorizationCode), now]
    );
    if (consumed.changes !== 1) {
      throw new InvalidGrantError('Código de autorización inválido, vencido o ya usado');
    }

    if (!isEmailAllowed(row.user_email)) {
      throw new InvalidGrantError('Acceso revocado');
    }
    return issueTokenPair({ clientId: client.client_id, email: row.user_email, scope: row.scope, resource: row.resource });
  },

  // Refresh tokens are single-use and rotated (public client): presenting one
  // revokes it and returns a brand-new pair.
  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    const row = await dbGet('SELECT * FROM mcp_refresh_tokens WHERE token_hash = ?', [sha256(refreshToken)]);
    if (!row || row.client_id !== client.client_id || row.revoked_at || row.expires_at <= nowIso()) {
      throw new InvalidGrantError('Refresh token inválido, vencido o ya usado');
    }
    if (scopes?.length && scopes.some((s) => s !== row.scope && s !== 'offline_access')) {
      throw new InvalidScopeError('No se puede ampliar el scope original');
    }
    if (resource && trimSlash(resource.href) !== row.resource) {
      throw new InvalidTargetError('resource no coincide con el de la autorización');
    }

    const rotated = await dbRun(
      'UPDATE mcp_refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL',
      [nowIso(), sha256(refreshToken)]
    );
    if (rotated.changes !== 1) {
      throw new InvalidGrantError('Refresh token inválido, vencido o ya usado');
    }

    if (!isEmailAllowed(row.user_email)) {
      throw new InvalidGrantError('Acceso revocado');
    }
    return issueTokenPair({ clientId: client.client_id, email: row.user_email, scope: row.scope, resource: row.resource });
  },

  // Runs on every /mcp request. Re-checks the allowlist each time (same as
  // requireAuth), so removing an email cuts MCP access immediately instead of
  // at token expiry.
  async verifyAccessToken(token) {
    const row = await dbGet('SELECT * FROM mcp_access_tokens WHERE token_hash = ?', [sha256(token)]);
    if (!row || row.revoked_at || row.expires_at <= nowIso()) {
      throw new InvalidTokenError('Token inválido, vencido o revocado');
    }
    if (!isEmailAllowed(row.user_email)) {
      throw new InvalidTokenError('Acceso revocado');
    }
    if (row.resource && row.resource !== mcpResourceUrl()) {
      throw new InvalidTokenError('Token emitido para otro recurso');
    }
    return {
      token,
      clientId: row.client_id,
      scopes: row.scope.split(' '),
      expiresAt: Math.floor(Date.parse(row.expires_at) / 1000),
      resource: row.resource ? new URL(row.resource) : undefined,
      extra: { email: row.user_email }
    };
  },

  // RFC 7009. Idempotent: an unknown token is not an error. Revoking a refresh
  // token also kills that user's live access tokens for this client, so
  // "disconnect" really disconnects.
  async revokeToken(client, { token }) {
    const hash = sha256(token);
    const stamp = nowIso();

    const refresh = await dbGet(
      'SELECT user_email FROM mcp_refresh_tokens WHERE token_hash = ? AND client_id = ?',
      [hash, client.client_id]
    );
    if (refresh) {
      await dbBatch([
        { sql: 'UPDATE mcp_refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL', args: [stamp, hash] },
        {
          sql: 'UPDATE mcp_access_tokens SET revoked_at = ? WHERE user_email = ? AND client_id = ? AND revoked_at IS NULL',
          args: [stamp, refresh.user_email, client.client_id]
        }
      ]);
      return;
    }
    await dbRun(
      'UPDATE mcp_access_tokens SET revoked_at = ? WHERE token_hash = ? AND client_id = ? AND revoked_at IS NULL',
      [stamp, hash, client.client_id]
    );
  }
};
