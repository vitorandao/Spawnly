'use strict';
const crypto=require('node:crypto');
const {bridge}=require('./_bridge');
const EXPECTED='dede107b1d4e31fd550677852d229099736860a5873c6fa25098b9cf00e68570';
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const token=typeof req.query?.token==='string'?req.query.token:'';
 const digest=crypto.createHash('sha256').update(token).digest('hex');
 if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='feature/spawnly-render-postgres-integration-20261117'||
    req.method!=='GET'||!token||!crypto.timingSafeEqual(Buffer.from(digest),Buffer.from(EXPECTED)))
   return res.status(404).json({erro:'Nao encontrado'});
 const oidcToken=String(req.headers['x-vercel-oidc-token']||'');
 const checks=[];
 const request=(method,route,body,userToken='',scope='user',id=null)=>
   bridge({method,scope,userToken,oidcToken,params:{route,...(id?{id}:{})},body});
 let uid=null,sid=null,userToken='';
 let failed=null;
 try{
  const status=await request('GET','status');
  if(status.status!==200||status.data.armazenamento!=='Render PostgreSQL 17')throw new Error('Status PostgreSQL indisponivel');
  checks.push('postgres-200');
  const before=await request('GET','usuarios');
  if(before.status!==200||!Array.isArray(before.data))throw new Error('Usuarios indisponiveis');
  checks.push('usuarios-leitura');
  const seed='8'+String(BigInt('0x'+crypto.randomBytes(6).toString('hex'))).padStart(17,'0');
  let out=await request('POST','usuarios',{nome:'Teste SQL '+crypto.randomBytes(4).toString('hex'),edicao:'Java',versao:'1.21.4'});
  if(out.status!==201||!out.data?.id||!out.data.token)throw new Error('CREATE usuario HTTP '+out.status);
  uid=out.data.id;userToken=out.data.token;checks.push('usuarios-create');
  out=await request('POST','preferencias',{usuario_id:uid,biomas:['planicies'],estruturas:['village'],estilos:['survival_tradicional'],pesos:{bioma:2,estrutura:2,estilo:2}},userToken);
  if(out.status!==201)throw new Error('CREATE preferencias HTTP '+out.status);
  checks.push('preferencias-create');
  out=await request('POST','recomendar',{usuario_id:uid},userToken);
  if(out.status!==200||!out.data?.total)throw new Error('Recomendacao HTTP '+out.status);
  checks.push('recomendacoes');
  const seedData={codigo:seed,nome:'Seed Teste SQL',edicao_versao_id:1,biomas:['planicies'],estruturas:['village']};
  out=await request('POST','seeds',seedData,'','admin');
  if(out.status!==201||!out.data?.id)throw new Error('CREATE seed HTTP '+out.status);
  sid=out.data.id;checks.push('seeds-create');
  out=await request('PUT','seeds',{...seedData,nome:'Seed Teste SQL Editada'},'','admin',sid);
  if(out.status!==200)throw new Error('UPDATE seed HTTP '+out.status);
  checks.push('seeds-update');
  out=await request('GET','seeds');
  if(out.status!==200||!Array.isArray(out.data)||out.data.find(x=>x.id===sid)?.nome!=='Seed Teste SQL Editada')throw new Error('Persistencia SQL falhou');
  checks.push('sql-persistencia');
 }catch(e){failed=String(e.message).slice(0,250);}
 finally{
  if(sid){try{const r=await request('DELETE','seeds',null,'','admin',sid);if(r.status===200)checks.push('seeds-delete');else failed=(failed||'')+' / cleanup-seed HTTP '+r.status;}catch(e){failed=(failed||'')+' / cleanup-seed '+e.message;}}
  if(uid){try{const r=await request('DELETE','usuarios',null,userToken,'user',uid);if(r.status===200)checks.push('usuarios-delete');else failed=(failed||'')+' / cleanup-user HTTP '+r.status;}catch(e){failed=(failed||'')+' / cleanup-user '+e.message;}}
 }
 return res.status(failed?500:200).json({resultado:failed?'FALHOU':'PASSOU',checks,erro:failed||undefined});
};