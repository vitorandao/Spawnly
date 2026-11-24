'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {trustedProjectForIssuer, hasTrustedClaims} = require('../oidc-auth');

function claims(project, environment='production', extra={}) {
  return {
    iss: 'https://oidc.vercel.com/' + project.team,
    aud: 'https://vercel.com/' + project.team,
    owner_id: project.ownerId,
    project_id: project.projectId || 'prj_new_opaque_value',
    environment,
    sub: `owner:${project.team}:project:${project.project}:environment:${environment}`,
    ...extra
  };
}

test('accept current Vercel project and environments', () => {
  const p = trustedProjectForIssuer('https://oidc.vercel.com/vitorandao');
  assert.equal(p.team, 'vitorandao');
  assert.ok(hasTrustedClaims(claims(p),p));
  assert.ok(hasTrustedClaims(claims(p,'preview'),p));
});

test('keep existing Vercel owner locked to the original project ID', () => {
  const p = trustedProjectForIssuer('https://oidc.vercel.com/jucilenejcl692-progs-projects');
  assert.ok(hasTrustedClaims(claims(p),p));
  assert.equal(hasTrustedClaims(claims(p,'production',{project_id:'prj_another'}),p),false);
});

test('reject unknown team, project, owner and unwanted environment', () => {
  const p = trustedProjectForIssuer('https://oidc.vercel.com/vitorandao');
  assert.equal(trustedProjectForIssuer('https://oidc.vercel.com/attacker'),null);
  assert.equal(hasTrustedClaims(claims(p,'production',{owner_id:'team_bad'}),p),false);
  assert.equal(hasTrustedClaims(claims(p,'production',{sub:'owner:vitorandao:project:other:environment:production'}),p),false);
  assert.equal(hasTrustedClaims(claims(p,'development'),p),false);
  assert.equal(hasTrustedClaims(null,p),false);
});
