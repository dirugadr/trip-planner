import { apiPost, apiGet } from './api.js';

// Exchange a Google ID token (credential) for a session token + user
export const loginWithGoogle = (credential) => apiPost('/auth/login', { credential });

// Validate the stored session token and get the current user
export const fetchMe = () => apiGet('/auth/me');
