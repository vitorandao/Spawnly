'use strict';
const http=require('node:http');
const backend=require('./backend');
const store=require('./store');
const PORT=Number(process.env.PORT||10000);
const MAX_BODY=400000;
const TEAM='jucilenejcl692-progs-projects';
const ISSUER='https://oidc.vercel.com/'+TEAM;
const AUDIENCE='https://vercel.com/'+TEAM;
const PROJECT='prj_AAQIVagjzkGau9jYbqSwANSuXbJ3';
const OWNER='team_Ighklbfq2CPFxWhpnua7JM5m';
let verifierPromise;
function verifier(){
 if(!verifierPromise)verifierPromise=import('jose').then(jose=>({
  jose, jwks:jose.createRemoteJWKSet(new URL(ISSUER+'/.well-known/jwks'))
 }));
 return verifierPromise;
}
function respond(res,status,data){
 if(res.writableEnded)return;
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
 res.end(JSON.stringify(data));
}
async function authenticate(req){
 const auth=String(req.headers.authorization||'');
 if(!auth.startsWith('Bearer ')||auth.length>10000)throw new Error('Credencial ausente');
 const {jose,jwks}=await verifier();
 const {payload}=await jose.jwtVerify(auth.slice(7),jwks,{issuer:ISSUER,audience:AUDIENCE});
 if(payload.project_id!==PROJECT||payload.owner_id!==OWNER||
  !['production','preview'].includes(payload.environment)||
  payload.sub!==('owner:'+TEAM+':project:spawnly:environment:'+payload.environment))
  throw new Error('Projeto nao autorizado');
 return payload.environment;
}
async function handle(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'&&req.method==='GET'){
  try{await store.ready();await store.pool.query('SELECT 1');return respond(res,200,{status:'ok',engine:'postgresql'});}
  catch(e){console.error('Postgres readiness:',e.message);return respond(res,503,{status:'unavailable'});}
 }
 if(!['/api/backend','/internal/import'].includes(url.pathname))return respond(res,404,{erro:'Nao encontrado'});
 let environment;
 try{environment=await authenticate(req);}catch(e){console.error('OIDC access denied:',e.message);return respond(res,401,{erro:'Nao autorizado'});}
 const scope=String(req.headers['x-spawnly-scope']||'');
 const userToken=String(req.headers['x-spawnly-user-token']||'');
 if(!['user','admin','import'].includes(scope)||userToken.length>180)return respond(res,401,{erro:'Escopo invalido'});
 let chunks=[],length=0;
 try{for await(const part of req){length+=part.length;if(length>MAX_BODY)return respond(res,413,{erro:'Corpo acima do limite.'});chunks.push(part);}}
 catch{return respond(res,400,{erro:'Corpo invalido'});}
 const body=Buffer.concat(chunks).toString('utf8');
 let parsed=null;
 if(body){try{parsed=JSON.parse(body);}catch{return respond(res,400,{erro:'JSON invalido'});}}
 if(url.pathname==='/internal/import'){
  if(scope!=='import'||environment!=='preview'||req.method!=='POST')return respond(res,403,{erro:'Nao autorizado'});
  try{return respond(res,200,{status:'imported',...await store.importState(parsed)});}
  catch(e){console.error('Migration:',e.message);return respond(res,409,{erro:e.message});}
 }
 if(scope==='import')return respond(res,403,{erro:'Escopo invalido'});
 const query={route:url.searchParams.get('route')||'',...(url.searchParams.has('id')?{id:url.searchParams.get('id')}:{})};
 if(url.searchParams.has('usuario_id'))query.usuario_id=url.searchParams.get('usuario_id');
 const compat={
  method:req.method,query,body:parsed,
  headers:{'x-spawnly-user-token':userToken,'x-spawnly-verified-admin':scope==='admin'?'1':'0'}
 };
 const response={
  statusCode:200,
  setHeader(){return this;},
  status(code){this.statusCode=code;return this;},
  json(data){respond(res,this.statusCode,data);return this;}
 };
 try{await backend(compat,response);if(!res.writableEnded)respond(res,500,{erro:'Resposta nao produzida'});}
 catch(e){console.error('API error:',e.message);respond(res,503,{erro:'Servico indisponivel'});}
}
const server=http.createServer((req,res)=>{handle(req,res).catch(e=>{console.error('Unhandled:',e.message);respond(res,503,{erro:'Servico indisponivel'});});});
server.listen(PORT,'0.0.0.0',()=>console.log('Spawnly PostgreSQL API started'));
process.on('SIGTERM',()=>{server.close();store.pool.end().catch(()=>{});});
