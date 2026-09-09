import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import config from '../config/index.js';

const encoder = new TextEncoder();
const sessionKey = () => encoder.encode(config.jwt.secret);

// Google's public keys — createRemoteJWKSet caches and refreshes them in memory.
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Verify a Google Identity Services ID token. Throws if the signature,
 * audience or issuer don't check out. Returns the relevant claims.
 */
export async function verifyGoogleToken(idToken) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: config.google.clientId
  });
  return {
    sub: payload.sub,
    email: (payload.email || '').toLowerCase(),
    email_verified: payload.email_verified === true || payload.email_verified === 'true',
    name: payload.name || null,
    picture: payload.picture || null
  };
}

export function isEmailAllowed(email) {
  const list = config.auth.allowedEmails;
  if (list.length === 0) return false; // fail closed
  return list.includes((email || '').toLowerCase());
}

/** Mint our own session token for an authenticated, allowed user. */
export function signSessionToken({ email, name, picture }) {
  return new SignJWT({ name: name || null, picture: picture || null })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(config.jwt.expiresIn)
    .sign(sessionKey());
}

/** Verify one of our session tokens. Throws if invalid/expired. */
export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, sessionKey());
  return {
    email: payload.sub,
    name: payload.name || null,
    picture: payload.picture || null
  };
}

export function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}
