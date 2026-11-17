'use strict';
const crypto = require('node:crypto');
const source = require('../frontend/api/_catalogo-inicial.json');
const { read, transact } = require('./store');
const { recomendarSeeds, versaoParaNumero } = require('../frontend/api/_recomendacao');
const ROUTES = new Set(['status','usuarios','seeds','preferencias','recomendar','catalogos']);
const ID_MAX = 2147483647;
const MIN_SEED = -9223372036854775808n, MAX_SEED = 9223372036854775807n;
function problem(status, message) { const e = new Error(message); e.status = status; throw e; }
function safeId(v) { const n=Number(v); return Number.isSafeInteger(n)&&n>0&&n<=ID_MAX?n:null; }
function str(v, max) { const s=typeof v==='string'?v.trim():''; return s && s.length<=max?s:null; }
function safeEqual(a,b) { if(typeof a!=='string'||typeof b!=='string'||!b) return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y); }
function userPublic(u){return {id:u.id,nome:u.nome,edicao:u.edicao,versao:u.versao};}
function checkUser(req, state, id){
 const u=state.usuarios.find(v=>v.id===id);
 if(!u) problem(404,'Usuario nao encontrado.');
 if(!safeEqual(req.headers['x-spawnly-user-token'],u.token)) problem(401,'Sessao do usuario invalida. Cadastre um novo jogador neste navegador.');
 return u;
}
function checkAdmin(req) {
 if(req.headers['x-spawnly-verified-admin'] !== '1') problem(401, 'Administracao nao autorizada.');
}
function validateUser(b){
 const nome=str(b?.nome,80), edicao=str(b?.edicao,7), versao=str(b?.versao,12);
 if(!nome||!['Java','Bedrock'].includes(edicao)||!versao||versaoParaNumero(versao)===null)problem(400,'Dados do usuario invalidos.');
 return {nome,edicao,versao};
}
function aliases(raw){
 const s=String(raw).trim().toLowerCase().replace(/-/g,'_').replace(/ /g,'_');
 if(source.biomas.some(x=>x.slug===s))return s;
 const map={
   plains:'planicies',sunflower_plains:'planicies',snowy_plains:'picos_nevados',
   forest:'florestas',birch_forest:'florestas',flower_forest:'florestas',dark_forest:'florestas',
   old_growth_birch_forest:'florestas',cherry_grove:'cherry_grove',
   meadow:'planicies',desert:'desertos',savanna:'savanas',savanna_plateau:'savanas',
   jungle:'selvas',bamboo_jungle:'selvas',sparse_jungle:'selvas',swamp:'pantanos',
   mangrove_swamp:'manguezais',taiga:'taiga',snowy_taiga:'taiga_nevada',
   old_growth_pine_taiga:'taiga',old_growth_spruce_taiga:'taiga',
   ocean:'oceanos_ilhas',deep_ocean:'oceanos_ilhas',cold_ocean:'oceanos_ilhas',
   frozen_ocean:'oceanos_ilhas',river:'oceanos_ilhas',beach:'oceanos_ilhas',
   badlands:'badlands',eroded_badlands:'badlands',wooded_badlands:'badlands',
   mountain:'montanhas',grove:'montanhas',windswept_hills:'montanhas',
   snowy_slopes:'picos_nevados',frozen_peaks:'picos_nevados',jagged_peaks:'picos_nevados',
   stony_peaks:'picos_nevados',mushroom_fields:'cogumelos'
 };
 return map[s]||'raros';
}
function slugs(input, tabela, allowEmpty=false) {
 if(!Array.isArray(input)||input.length>25)problem(400,'Lista de preferencias invalida.');
 const allowed = new Set(tabela.map(x=>x.slug));
 const unique=[...new Set(input.map(x=>String(x).trim()))];
 if((!allowEmpty&&!unique.length)||unique.some(x=>!allowed.has(x)))problem(400,'Valores do catalogo invalidos.');
 return unique;
}
function validatePrefs(b) {
 const usuario_id=safeId(b?.usuario_id);
 if(!usuario_id)problem(400,'ID de usuario invalido.');
 const biomas=slugs((b.biomas||[]).map(aliases),source.biomas);
 const estruturas=slugs(b.estruturas||[],source.estruturas,true);
 const estilos=slugs(b.estilos||[],source.estilos);
 const pesos={bioma:Number(b.pesos?.bioma??2),estrutura:Number(b.pesos?.estrutura??2),estilo:Number(b.pesos?.estilo??2)};
 if(Object.values(pesos).some(n=>![1,2,3].includes(n)))problem(400,'Pesos invalidos.');
 return {usuario_id,biomas,estruturas,estilos,pesos};
}
function seedList(s){return s.seeds===null?source.seeds:s.seeds;}
function validateSeed(b) {
 const codigo=String(b?.codigo??'').trim(),nome=str(b?.nome,120),
       edicao_versao_id=safeId(b?.edicao_versao_id);
 if(!/^-?\d{1,19}$/.test(codigo))problem(400,'Codigo da seed invalido.');
 const big=BigInt(codigo);if(big<MIN_SEED||big>MAX_SEED)problem(400,'Codigo fora de 64 bits.');
 const v=source.versoes.find(x=>x.id===edicao_versao_id);
 if(!v||!nome)problem(400,'Nome ou edicao/versao invalidos.');
 const biomas=slugs(b.biomas||[],source.biomas);
 const estruturas=slugs(b.estruturas||[],source.estruturas,true);
 const spawn_texto=b.spawn_texto?str(b.spawn_texto,40):null;
 const nota=b.nota?str(b.nota,5000):null;
 const dificuldade=b.dificuldade==null||b.dificuldade===''?null:Number(b.dificuldade);
 const multiplayer=b.multiplayer||null;
 if((b.spawn_texto&&!spawn_texto)||(b.nota&&!nota)||
   (dificuldade!==null&&![1,2,3,4,5].includes(dificuldade))||
   (multiplayer&&!['baixo','medio','alto'].includes(multiplayer)))problem(400,'Informacoes da seed invalidas.');
 return {codigo:String(big),nome,edicao_versao_id,edicao:v.edicao,versao:v.versao_texto,
   versao_min_num:v.versao_min_num,versao_max_num:v.versao_max_num,
   spawn_texto,dificuldade,dificuldade_base:null,multiplayer,nota,
   biomas:biomas.map(slug=>({slug,nome:source.biomas.find(x=>x.slug===slug).nome})),
   estruturas:estruturas.map(slug=>({slug,nome:source.estruturas.find(x=>x.slug===slug).nome,dist_spawn:null,coord_x:null,coord_z:null})),
   verificacao:'pendente',atualizado_em:new Date().toISOString().slice(0,10)};
}
function bodyFrom(req) {
 let b=req.body;
 if(Buffer.isBuffer(b)) b=b.toString();
 if(typeof b==='string'){try{b=JSON.parse(b)}catch{problem(400,'JSON invalido.');}}
 if(!b||typeof b!=='object'||Array.isArray(b))problem(400,'Corpo JSON obrigatorio.');
 if(JSON.stringify(b).length>100000)problem(413,'Requisicao muito grande.');
 return b;
}
async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 const route=req.query?.route, idParam=req.query?.id;
 if(typeof route!=='string'||!ROUTES.has(route))return res.status(404).json({erro:'Rota nao encontrada.'});
 if(idParam!==undefined&&(!/^\d+$/.test(String(idParam))||!safeId(idParam)))return res.status(400).json({erro:'ID invalido.'});
 const method=req.method.toUpperCase();
 try{
  if(route==='status'&&method==='GET'){
   const {state}=await read();
   return res.status(200).json({status:'ok',banco:'conectado',aplicacao:'Spawnly',
     armazenamento:'Render PostgreSQL 17',revision:state.revision});
  }
  if(route==='catalogos'&&method==='GET'){
   const {seeds,...catalogos}=source; return res.status(200).json(catalogos);
  }
  if(route==='seeds'){
   if(method==='GET')return res.status(200).json(seedList((await read()).state));
   checkAdmin(req);
   if(method==='POST'){
    const data=validateSeed(bodyFrom(req));
    const value=await transact(s=>{const seeds=seedList(s);if(seeds.some(x=>x.codigo===data.codigo&&x.edicao_versao_id===data.edicao_versao_id))problem(409,'Seed ja cadastrada nesta versao.');
      const id=Math.max(0,...seeds.map(x=>x.id))+1;
      s.seeds=[...seeds,{id,...data}];return {mensagem:'Seed cadastrada com sucesso.',id};});
    return res.status(201).json(value);
   }
   if(!safeId(idParam))problem(400,'ID invalido.');
   if(method==='PUT'){const data=validateSeed(bodyFrom(req));const value=await transact(s=>{
      const seeds=seedList(s);const idx=seeds.findIndex(x=>x.id===safeId(idParam));if(idx===-1)problem(404,'Seed nao encontrada.');
      if(seeds.some(x=>x.id!==safeId(idParam)&&x.codigo===data.codigo&&x.edicao_versao_id===data.edicao_versao_id))problem(409,'Seed ja cadastrada nesta versao.');
      s.seeds=seeds.slice();s.seeds[idx]={id:safeId(idParam),...data};return {mensagem:'Seed atualizada com sucesso.',id:safeId(idParam)};
     });return res.status(200).json(value);}
   if(method==='DELETE'){const value=await transact(s=>{const seeds=seedList(s);if(!seeds.some(x=>x.id===safeId(idParam)))problem(404,'Seed nao encontrada.');s.seeds=seeds.filter(x=>x.id!==safeId(idParam));return {mensagem:'Seed excluida com sucesso.',id:safeId(idParam)};});return res.status(200).json(value);}
  }
  if(route==='usuarios'){
   if(method==='GET')return res.status(200).json((await read()).state.usuarios.map(userPublic));
   if(method==='POST'){const data=validateUser(bodyFrom(req));const value=await transact(s=>{
      const id=Math.max(0,...s.usuarios.map(x=>x.id))+1;
      const token=crypto.randomBytes(32).toString('base64url');
      s.usuarios.push({id,...data,token});return {id,...data,token,mensagem:'Usuario cadastrado.'};
     });return res.status(201).json(value);}
   const id=safeId(idParam);if(!id)problem(400,'ID invalido.');
   if(method==='PUT'){const data=validateUser(bodyFrom(req));const value=await transact(s=>{const u=checkUser(req,s,id);Object.assign(u,data);return {...userPublic(u),token:u.token,mensagem:'Usuario atualizado.'};});return res.status(200).json(value);}
   if(method==='DELETE'){const value=await transact(s=>{checkUser(req,s,id);s.usuarios=s.usuarios.filter(x=>x.id!==id);delete s.preferencias[id];return {id,mensagem:'Usuario excluido.'};});return res.status(200).json(value);}
  }
  if(route==='preferencias'){
   if(method==='GET'){const {state}=await read();const uid=req.query.usuario_id==null?null:safeId(req.query.usuario_id);
     if(req.query.usuario_id!=null&&!uid)problem(400,'ID invalido.');
     const list=Object.values(state.preferencias).filter(x=>!uid||x.usuario_id===uid).map(p=>({...p,usuario:state.usuarios.find(x=>x.id===p.usuario_id)?.nome||''}));
     return res.status(200).json(list);}
   if(method==='POST'||method==='PUT'){
     const b=bodyFrom(req); if(method==='PUT')b.usuario_id=safeId(idParam);
     const p=validatePrefs(b);
     const value=await transact(s=>{checkUser(req,s,p.usuario_id);s.preferencias[p.usuario_id]={id:p.usuario_id,...p};
       return {mensagem:'Preferencias salvas com sucesso.',id:p.usuario_id};});
     return res.status(method==='POST'?201:200).json(value);
   }
   if(method==='DELETE'){const uid=safeId(idParam);if(!uid)problem(400,'ID invalido.');const value=await transact(s=>{checkUser(req,s,uid);if(!s.preferencias[uid])problem(404,'Preferencias nao encontradas.');delete s.preferencias[uid];return {id:uid,mensagem:'Preferencias excluidas.'};});return res.status(200).json(value);}
  }
  if(route==='recomendar'&&method==='POST'){
   const b=bodyFrom(req),uid=safeId(b.usuario_id);if(!uid)problem(400,'ID invalido.');
   const {state}=await read();const user=checkUser(req,state,uid);
   const pref=state.preferencias[uid];if(!pref)problem(404,'Preferencias do usuario nao encontradas.');
   const recomendacoes=recomendarSeeds(seedList(state),pref,user.edicao,user.versao);
   return res.status(200).json({usuario:userPublic(user),preferencias:pref,regra_pontuacao:{biomas:60,estruturas:40},total:recomendacoes.length,recomendacoes});
  }
  res.setHeader('Allow','GET, POST, PUT, DELETE');
  return res.status(405).json({erro:'Metodo nao permitido.'});
 }catch(error) {
  const code=(Number(error.status)>=400&&Number(error.status)<600)?error.status:503;
  if(code===503) console.error('API Spawnly:',error.name||'Erro',String(error.message).slice(0,140));
  return res.status(code).json({erro:code===503?'Armazenamento temporariamente indisponivel.':error.message});
 }
}
module.exports=handler;
