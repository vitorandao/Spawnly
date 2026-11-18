'use strict';

// Both origins refer to Spawnly. Accept only Vercel-signed tokens scoped
// to an explicitly trusted team, project, and environment.
const TRUSTED_PROJECTS = Object.freeze([
  Object.freeze({
    team: 'jucilenejcl692-progs-projects',
    ownerId: 'team_Ighklbfq2CPFxWhpnua7JM5m',
    project: 'spawnly',
    projectId: 'prj_AAQIVagjzkGau9jYbqSwANSuXbJ3'
  }),
  Object.freeze({
    team: 'vitorandao',
    ownerId: 'team_aOArF2pAnPEcBjqgYFKgmk4f',
    project: 'spawnly'
  })
]);

const jwksByIssuer = new Map();
let josePromise;

function trustedProjectForIssuer(issuer) {
  return TRUSTED_PROJECTS.find(project => issuer === 'https://oidc.vercel.com/' + project.team) || null;
}

function hasTrustedClaims(payload, project) {
  if (!payload || !project) return false;
  const env = payload.environment;
  return (env === 'production' || env === 'preview') &&
    payload.owner_id === project.ownerId &&
    payload.sub === `owner:${project.team}:project:${project.project}:environment:${env}` &&
    (!project.projectId || payload.project_id === project.projectId);
}

async function verifyBearer(authorization) {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ') ||
      authorization.length > 10000) throw new Error('Credencial ausente');
  const token = authorization.slice('Bearer '.length);
  const jose = await (josePromise ||= import('jose'));
  // Unverified claims are used exclusively to select an allowlisted verifier.
  // Authentication uses only the verified payload from jwtVerify below.
  const claimedIssuer = jose.decodeJwt(token).iss;
  const project = trustedProjectForIssuer(claimedIssuer);
  if (!project) throw new Error('Emissor nao autorizado');
  const issuer = 'https://oidc.vercel.com/' + project.team;
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(issuer + '/.well-known/jwks'));
    jwksByIssuer.set(issuer, jwks);
  }
  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer,
    audience: 'https://vercel.com/' + project.team
  });
  if (!hasTrustedClaims(payload, project)) throw new Error('Projeto nao autorizado');
  return payload.environment;
}

module.exports = { verifyBearer, trustedProjectForIssuer, hasTrustedClaims };
