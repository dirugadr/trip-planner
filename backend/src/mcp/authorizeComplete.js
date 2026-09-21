import express from 'express';
import { mcpConfigError } from '../config/index.js';
import { verifyGoogleToken, isEmailAllowed } from '../lib/auth.js';
import { OAuthError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { validateAuthorizeRequest, issueAuthorizationCode, withIssuer } from './oauthProvider.js';
import { MCP_SCOPE, MCP_WRITE_SCOPE } from './scopes.js';

/**
 * Second half of the authorization-code flow. /oauth/authorize (SDK) sends the
 * browser to the consent page; the page signs in with Google (same Google
 * Sign-In as the web app) and posts here. We verify the Google token, apply
 * the same allowlist gate as /api/auth/login, and only then mint the code.
 * The caller never sees a code unless an allowlisted, verified email approved.
 *
 * `verifyGoogle` is injectable so the flow can be exercised without a real
 * Google-signed token.
 */
export function createMcpAuthorizeRouter({ verifyGoogle = verifyGoogleToken } = {}) {
  const router = express.Router();

  router.post('/authorize', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const configErr = mcpConfigError();
    if (configErr) return res.status(503).json({ success: false, error: configErr });

    const body = req.body || {};

    let request;
    try {
      request = await validateAuthorizeRequest(body);
    } catch (e) {
      if (e instanceof OAuthError) return res.status(400).json({ success: false, error: e.message });
      throw e;
    }

    const redirectTo = (params) => {
      const url = new URL(request.redirectUri);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      if (typeof body.state === 'string' && body.state) url.searchParams.set('state', body.state);
      return withIssuer(url.href);
    };

    if (body.deny === true) {
      return res.json({ success: true, data: { redirect_url: redirectTo({ error: 'access_denied' }) } });
    }

    if (!body.credential || typeof body.credential !== 'string') {
      return res.status(400).json({ success: false, error: 'Falta el token de Google (credential)' });
    }

    let gUser;
    try {
      gUser = await verifyGoogle(body.credential);
    } catch {
      return res.status(401).json({ success: false, error: 'Token de Google inválido' });
    }
    if (!gUser.email || !gUser.email_verified) {
      return res.status(403).json({ success: false, error: 'La cuenta de Google no tiene un email verificado' });
    }
    if (!isEmailAllowed(gUser.email)) {
      return res.status(403).json({ success: false, error: 'Tu cuenta no está habilitada para usar esta app' });
    }

    // Write access (HU-12.3) needs BOTH the client asking for it and the traveler
    // explicitly ticking the box on the consent screen. Anything else is read-only.
    const scope =
      request.scopes.includes(MCP_WRITE_SCOPE) && body.grant_write === true
        ? `${MCP_SCOPE} ${MCP_WRITE_SCOPE}`
        : MCP_SCOPE;

    const code = await issueAuthorizationCode({
      clientId: request.client.client_id,
      email: gUser.email,
      codeChallenge: request.codeChallenge,
      redirectUri: request.redirectUri,
      resource: request.resource,
      scope
    });

    res.json({ success: true, data: { redirect_url: redirectTo({ code }), email: gUser.email, scope } });
  });

  return router;
}

export default createMcpAuthorizeRouter;
