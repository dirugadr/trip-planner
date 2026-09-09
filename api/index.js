// Vercel serverless entry point. All /api/* requests are rewritten here
// (see vercel.json) and handled by the Express app, which owns its own routing.
// Migrations are NOT run here — run `npm run migrate` once against Turso.
import app from '../backend/src/app.js';

export default app;
