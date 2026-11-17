'use strict';
const { Pool } = require('pg');
const source = require('../frontend/api/_catalogo-inicial.json');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nao configurada');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5,
  connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
let initialization;
const DDL = [
'CREATE TABLE IF NOT EXISTS spawnly_meta (id integer primary key, revision bigint not null default 0, seeded boolean not null default false)',
'CREATE TABLE IF NOT EXISTS spawnly_users (id integer primary key, nome text not null, edicao text not null, versao text not null, token text not null)',
'CREATE TABLE IF NOT EXISTS spawnly_preferences (usuario_id integer primary key references spawnly_users(id) on delete cascade, biomas text[] not null, estruturas text[] not null, estilos text[] not null, pesos jsonb not null)',
'CREATE TABLE IF NOT EXISTS spawnly_seeds (id integer primary key, codigo text not null, nome text not null, edicao_versao_id integer not null, edicao text not null, versao text not null, versao_min_num bigint not null, versao_max_num bigint not null, spawn_texto text, dificuldade integer, dificuldade_base integer, multiplayer text, nota text, atualizado_em text, verificacao text, unique(codigo,edicao_versao_id))',
'CREATE TABLE IF NOT EXISTS spawnly_seed_biomas (seed_id integer not null references spawnly_seeds(id) on delete cascade, slug text not null, nome text, primary key(seed_id,slug))',
'CREATE TABLE IF NOT EXISTS spawnly_seed_estruturas (seed_id integer not null references spawnly_seeds(id) on delete cascade, slug text not null, nome text, dist_spawn integer, coord_x integer, coord_z integer, primary key(seed_id,slug))',
'CREATE TABLE IF NOT EXISTS spawnly_request_nonce (nonce text primary key, created_at timestamptz not null default now())'
];
async function insertSeed(c,seed) {
 const fields=['id','codigo','nome','edicao_versao_id','edicao','versao','versao_min_num','versao_max_num','spawn_texto','dificuldade','dificuldade_base','multiplayer','nota','atualizado_em','verificacao'];
 const args=fields.map(k=>seed[k]??null);
 const columns=fields.join(',');
 const vals=fields.map((_,i)=>'$'+(i+1)).join(',');
 const sets=fields.slice(1).map(k=>k+'=EXCLUDED.'+k).join(',');
 await c.query('INSERT INTO spawnly_seeds('+columns+') VALUES('+vals+') ON CONFLICT (id) DO UPDATE SET '+sets,args);
 await c.query('DELETE FROM spawnly_seed_biomas WHERE seed_id=$1',[seed.id]);
 await c.query('DELETE FROM spawnly_seed_estruturas WHERE seed_id=$1',[seed.id]);
 for(const b of seed.biomas||[])await c.query('INSERT INTO spawnly_seed_biomas(seed_id,slug,nome) VALUES($1,$2,$3)',[seed.id,b.slug,b.nome||null]);
 for(const e of seed.estruturas||[])await c.query('INSERT INTO spawnly_seed_estruturas(seed_id,slug,nome,dist_spawn,coord_x,coord_z) VALUES($1,$2,$3,$4,$5,$6)',[seed.id,e.slug,e.nome||null,e.dist_spawn??null,e.coord_x??null,e.coord_z??null]);
}
async function initialize(){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  await c.query('SELECT pg_advisory_xact_lock($1)',[16964029]);
  for(const sql of DDL)await c.query(sql);
  await c.query('INSERT INTO spawnly_meta(id,revision,seeded) VALUES(1,0,false) ON CONFLICT(id) DO NOTHING');
  const meta=await c.query('SELECT seeded FROM spawnly_meta WHERE id=1 FOR UPDATE');
  if(!meta.rows[0].seeded){
   const rows=await c.query('SELECT COUNT(*)::int AS n FROM spawnly_seeds');
   if(rows.rows[0].n===0)for(const seed of source.seeds)await insertSeed(c,seed);
   await c.query('UPDATE spawnly_meta SET seeded=true WHERE id=1');
  }
  await c.query('COMMIT');
 }catch(err){await c.query('ROLLBACK').catch(()=>{});throw err;}
 finally{c.release();}
}
async function ready(){if(!initialization)initialization=initialize().catch(e=>{initialization=null;throw e;});await initialization;}
async function load(c){
 const [meta,u,p,s,b,e]=await Promise.all([
  c.query('SELECT revision FROM spawnly_meta WHERE id=1'),
  c.query('SELECT id,nome,edicao,versao,token FROM spawnly_users ORDER BY id'),
  c.query('SELECT * FROM spawnly_preferences ORDER BY usuario_id'),
  c.query('SELECT * FROM spawnly_seeds ORDER BY id'),
  c.query('SELECT * FROM spawnly_seed_biomas ORDER BY seed_id,slug'),
  c.query('SELECT * FROM spawnly_seed_estruturas ORDER BY seed_id,slug')
 ]);
 const prefs={};
 for(const row of p.rows)prefs[row.usuario_id]={id:row.usuario_id,usuario_id:row.usuario_id,biomas:row.biomas,estruturas:row.estruturas,estilos:row.estilos,pesos:row.pesos};
 const seeds=s.rows.map(x=>({...x,versao_min_num:Number(x.versao_min_num),versao_max_num:Number(x.versao_max_num),biomas:[],estruturas:[]}));
 const byId=new Map(seeds.map(x=>[x.id,x]));
 for(const r of b.rows){const x=byId.get(r.seed_id);if(x)x.biomas.push({slug:r.slug,nome:r.nome});}
 for(const r of e.rows){const x=byId.get(r.seed_id);if(x)x.estruturas.push({slug:r.slug,nome:r.nome,dist_spawn:r.dist_spawn,coord_x:r.coord_x,coord_z:r.coord_z});}
 return {revision:Number(meta.rows[0]?.revision||0),usuarios:u.rows,preferencias:prefs,seeds};
}
async function read(){
 await ready();const c=await pool.connect();
 try{await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const state=await load(c);await c.query('COMMIT');return {state,revision:state.revision};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
const comparable=x=>JSON.stringify(x);
async function transact(mutator){
 await ready();const c=await pool.connect();
 try{
  await c.query('BEGIN');
  await c.query('SELECT revision FROM spawnly_meta WHERE id=1 FOR UPDATE');
  const old=await load(c),newState=structuredClone(old);
  const result=await mutator(newState);
  const oldUsers=new Map(old.usuarios.map(x=>[x.id,x]));
  const newUsers=new Map(newState.usuarios.map(x=>[x.id,x]));
  for(const u of newState.usuarios)if(comparable(u)!==comparable(oldUsers.get(u.id)))
   await c.query('INSERT INTO spawnly_users(id,nome,edicao,versao,token) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET nome=EXCLUDED.nome,edicao=EXCLUDED.edicao,versao=EXCLUDED.versao,token=EXCLUDED.token',[u.id,u.nome,u.edicao,u.versao,u.token]);
  for(const u of old.usuarios)if(!newUsers.has(u.id))await c.query('DELETE FROM spawnly_users WHERE id=$1',[u.id]);
  const oldPrefs=old.preferencias||{},newPrefs=newState.preferencias||{};
  for(const id of Object.keys(oldPrefs))if(!Object.hasOwn(newPrefs,id))await c.query('DELETE FROM spawnly_preferences WHERE usuario_id=$1',[Number(id)]);
  for(const [id,p] of Object.entries(newPrefs))if(comparable(p)!==comparable(oldPrefs[id]))
   await c.query('INSERT INTO spawnly_preferences(usuario_id,biomas,estruturas,estilos,pesos) VALUES($1,$2,$3,$4,$5) ON CONFLICT(usuario_id) DO UPDATE SET biomas=EXCLUDED.biomas,estruturas=EXCLUDED.estruturas,estilos=EXCLUDED.estilos,pesos=EXCLUDED.pesos',
    [Number(id),p.biomas||[],p.estruturas||[],p.estilos||[],JSON.stringify(p.pesos||{})]);
  const oldSeeds=new Map(old.seeds.map(x=>[x.id,x])),newSeeds=new Map((newState.seeds||source.seeds).map(x=>[x.id,x]));
  for(const seed of old.seeds)if(!newSeeds.has(seed.id))await c.query('DELETE FROM spawnly_seeds WHERE id=$1',[seed.id]);
  for(const seed of newSeeds.values())if(comparable(seed)!==comparable(oldSeeds.get(seed.id)))await insertSeed(c,seed);
  await c.query('UPDATE spawnly_meta SET revision=revision+1 WHERE id=1');
  await c.query('COMMIT');
  return result;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}
 finally{c.release();}
}
async function once(nonce){
 await ready();
 const client=await pool.connect();
 try{const r=await client.query('INSERT INTO spawnly_request_nonce(nonce) VALUES($1) ON CONFLICT DO NOTHING RETURNING nonce',[nonce]);
  if(Math.random()<.02)await client.query("DELETE FROM spawnly_request_nonce WHERE created_at < NOW() - INTERVAL '5 minutes'");
  return r.rowCount===1;
 }finally{client.release();}
}
async function importState(snapshot){
 await ready();const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const locked=await c.query('SELECT revision FROM spawnly_meta WHERE id=1 FOR UPDATE');
  const users=await c.query('SELECT count(*)::int AS n FROM spawnly_users');
  if(users.rows[0].n || Number(locked.rows[0].revision)>0)throw new Error('Banco ja inicializado com dados. Importacao bloqueada.');
  const expectedSeedIds=new Set(source.seeds.map(x=>x.id));
  if(!snapshot||!Array.isArray(snapshot.usuarios)||typeof snapshot.preferencias!=='object'||!Array.isArray(snapshot.seeds)&&snapshot.seeds!==null)
   throw new Error('Backup invalido');
  if(snapshot.usuarios.length>5000||Object.keys(snapshot.preferencias).length>5000||(snapshot.seeds?.length||0)>5000)throw new Error('Backup acima do limite.');
  for(const u of snapshot.usuarios)await c.query('INSERT INTO spawnly_users(id,nome,edicao,versao,token) VALUES($1,$2,$3,$4,$5)',
   [u.id,u.nome,u.edicao,u.versao,u.token]);
  for(const p of Object.values(snapshot.preferencias))await c.query('INSERT INTO spawnly_preferences(usuario_id,biomas,estruturas,estilos,pesos) VALUES($1,$2,$3,$4,$5)',
   [p.usuario_id,p.biomas||[],p.estruturas||[],p.estilos||[],JSON.stringify(p.pesos||{})]);
  if(snapshot.seeds){
   for(const seed of snapshot.seeds){
    if(expectedSeedIds.has(seed.id))expectedSeedIds.delete(seed.id);
    await insertSeed(c,seed);
   }
   for(const id of expectedSeedIds)await c.query('DELETE FROM spawnly_seeds WHERE id=$1',[id]);
  }
  await c.query('UPDATE spawnly_meta SET revision=$1 WHERE id=1',[Number(snapshot.revision||0)+1]);
  await c.query('COMMIT');
  return {migratedUsers:snapshot.usuarios.length,migratedSeeds:snapshot.seeds?.length??source.seeds.length};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
module.exports={pool,ready,read,transact,once,importState};
