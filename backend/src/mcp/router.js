import express from 'express';
import rateLimit from 'express-rate-limit';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { revocationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/revoke.js';
import { mcpAuthMetadataRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { mcpConfigError } from '../config/index.js';
import { oauthProvider, MCP_SCOPE, mcpIssuerUrl, mcpResourceUrl, consentPageUrl, withIssuer } from './oauthProvider.js';
import { createMcpServer } from './tools.js';

/**
 * Épica 12 — remote MCP server + its OAuth 2.1 authorization server, mounted
 * at the app root (NOT under /api: it has its own auth, separate from
 * requireAuth / the web session JWT).
 *
 *   /.well-known/oauth-authorization-server         RFC 8414 metadata
 *   /.well-known/oauth-protected-resource/mcp       RFC 9728 metadata
 *   /oauth/authorize | /oauth/token | /oauth/revoke | /oauth/register
 *                                                   SDK handlers over our provider
 *   POST /mcp                                       stateless Streamable HTTP
 */
export function createMcpRouter() {
  const router = express.Router();

  // Fail closed when not configured (missing JWT secret / Google client id /
  // PUBLIC_URL_TP) — same posture as requireAuth's 503.
  const guard = (req, res, next) => {
    const err = mcpConfigError();
    if (err) return res.status(503).json({ error: 'temporarily_unavailable', error_description: err });
    next();
  };

  const oauthMetadata = () => ({
    issuer: mcpIssuerUrl(),
    authorization_endpoint: `${mcpIssuerUrl()}/oauth/authorize`,
    token_endpoint: `${mcpIssuerUrl()}/oauth/token`,
    revocation_endpoint: `${mcpIssuerUrl()}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    // Public clients only (PKCE, no secret). Claude uses its fixed client id;
    // ChatGPT registers itself here (HU-12.4, RFC 7591).
    registration_endpoint: `${mcpIssuerUrl()}/oauth/register`,
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [MCP_SCOPE, 'offline_access'],
    // RFC 9207: every authorization response (success or error) carries `iss`.
    authorization_response_iss_parameter_supported: true
  });

  // The SDK builds error redirects itself (`?error=...`) without `iss`, but we
  // advertise RFC 9207, so add it to every redirect back to the client. Only
  // the hop to our own consent page is left alone.
  const issuerOnRedirects = (req, res, next) => {
    const redirect = res.redirect.bind(res);
    res.redirect = (...args) => {
      const [status, url] = typeof args[0] === 'number' ? args : [302, args[0]];
      const target = new URL(url);
      const consent = new URL(consentPageUrl());
      const toConsent = target.origin === consent.origin && target.pathname === consent.pathname;
      return redirect(status, toConsent ? url : withIssuer(url));
    };
    next();
  };

  // Metadata is built per request so it always reflects the current config.
  router.use((req, res, next) => {
    if (!req.path.startsWith('/.well-known/')) return next();
    const err = mcpConfigError();
    if (err) return res.status(503).json({ error: 'temporarily_unavailable', error_description: err });
    return mcpAuthMetadataRouter({
      oauthMetadata: oauthMetadata(),
      resourceServerUrl: new URL(mcpResourceUrl()),
      scopesSupported: [MCP_SCOPE],
      resourceName: 'Trip Planner'
    })(req, res, next);
  });

  router.use('/oauth/authorize', guard, issuerOnRedirects, authorizationHandler({ provider: oauthProvider }));
  // Dynamic client registration: the SDK handler validates the RFC 7591 body and
  // rate-limits (20/h per IP); clientsStore.registerClient enforces the redirect
  // URI allowlist and forces a public client.
  router.use('/oauth/register', guard, clientRegistrationHandler({ clientsStore: oauthProvider.clientsStore }));
  router.use('/oauth/token', guard, tokenHandler({ provider: oauthProvider }));
  router.use('/oauth/revoke', guard, revocationHandler({ provider: oauthProvider }));

  const mcpLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests', error_description: 'Demasiadas solicitudes, probá en un minuto' }
  });

  router.post(
    '/mcp',
    guard,
    mcpLimiter,
    (req, res, next) =>
      requireBearerAuth({
        verifier: oauthProvider,
        requiredScopes: [MCP_SCOPE],
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(mcpResourceUrl()))
      })(req, res, next),
    async (req, res) => {
      // Stateless: a fresh server+transport per request suits serverless
      // (no session to keep alive). JSON responses instead of SSE streams.
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('MCP request error:', error);
        if (!res.headersSent) {
          res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
        }
      }
    }
  );

  // Stateless server: no standalone SSE stream, no session to terminate.
  const notAllowed = (req, res) =>
    res
      .status(405)
      .set('Allow', 'POST')
      .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  router.get('/mcp', notAllowed);
  router.delete('/mcp', notAllowed);

  return router;
}

export default createMcpRouter;
