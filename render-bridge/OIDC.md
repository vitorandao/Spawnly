# Spawnly: Vercel to Render OIDC

The Render backend requires a signed Vercel OIDC token. A successful Vercel build does not test this integration.

The trusted identities in `oidc-auth.js` are intentionally restricted to the legacy `jucilenejcl692-progs-projects/spawnly` project and the current `vitorandao/spawnly` project. The old identity keeps its exact project ID check. The new identity is bound to its exact Vercel team ID, the signed `sub` identifying the `spawnly` project, and its environment. Once Vercel project settings are available, its project ID can also be pinned.

Before testing live traffic, confirm that:
1. Vercel project setting "Secure backend access with OIDC federation" is enabled and uses **Team** issuer mode.
2. `SPAWNLY_RENDER_API_URL` in Vercel is set to the HTTPS Render API host ending in `.onrender.com`.
3. Render deploys the updated `render-bridge` code from `feature/spawnly-render-postgres-integration-20261117` and has `DATABASE_URL` configured.
4. `GET /health` on Render reports a healthy PostgreSQL connection.
5. `GET https://spawnly-ten.vercel.app/api/status` returns status 200 with `status: ok`, and `GET /api/catalogos` and the authenticated CRUD flow succeed.

Never copy OIDC JWTs or database passwords into GitHub, issues, or logs. If the app moves to another Vercel owner or project, review and update the allowlist rather than disabling JWT verification.

Run the zero-dependency claim tests with `node --test render-bridge/test/*.test.js`. These tests do not replace a real signed-token integration test.
