'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const backend=require('./backend');
const store=require('./store');
const publicKey=crypto.createPublicKey(
 '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA6pfRehdGgsbRgHSzNA2vxn78nRqulWr/V+dgZHJW4Zc=\n-----END PUBLIC KEY-----'
);
const MAX_BODY=400000;
const PORT=Number(process.env.PORT||10000);
function respond(res,status,data){
 if(res.writableEnded)return;
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
 res.end(JSON.stringify(data));
}
async function handle(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'&&req.method==='GET'){
  try{await store.ready();await store.pool.query('SELECT 1');return respond(res,200,{status:'ok',engine:'postgresql'});}
  catch(e){console.error('Postgres readiness:',e.message);return respond(res,503,{status:'unavailable'});}
 }
 if(!['/api/backend','/internal/import'].includes(url.pathname))return respond(res,404,{erro:'Nao encontrado'});
 const timestamp=String(req.headers['x-spawnly-timestamp']||'');
 const nonce=String(req.headers['x-spawnly-nonce']||'');
 const signature=String(req.headers['x-spawnly-signature']||'');
 const scope=String(req.headers['x-spawnly-scope']||'');
 const userToken=String(req.headers['x-spawnly-user-token']||'');
 if(!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>90000||
   !/^[a-f0-9]{32}$/.test(nonce)||!['user','admin','import'].includes(scope)||
   signature.length>256||userToken.length>180)return respond(res,401,{erro:'Assinatura invalida.'});
 let chunks=[],length=0;
 try{for await(const part of req){length+=part.length;if(length>MAX_BODY)return respond(res,413,{erro:'Corpo acima do limite.'});chunks.push(part);}}
 catch{return respond(res,400,{erro:'Corpo invalido'});}
 const body=Buffer.concat(chunks).toString('utf8');
 const signed=Buffer.from(JSON.stringify([timestamp,nonce,req.method,url.pathname+url.search,scope,userToken,body]));
 let signatureOK=false;
 try{signatureOK=crypto.verify(null,signed,publicKey,Buffer.from(signature,'base64'));}
 catch{}
 if(!signatureOK)return respond(res,401,{erro:'Assinatura invalida.'});
 try{if(!await store.once(nonce))return respond(res,409,{erro:'Requisicao repetida'});}
 catch(e){console.error('Nonce validation:',e.message);return respond(res,503,{erro:'Banco indisponivel'});}
 let parsed=null;
 if(body){try{parsed=JSON.parse(body);}catch{return respond(res,400,{erro:'JSON invalido'});}}
 if(url.pathname==='/internal/import'){
  if(scope!=='import'||req.method!=='POST')return respond(res,403,{erro:'Nao autorizado.'});
  try{return respond(res,200,{status:'imported',...await store.importState(parsed)});}
  catch(e){console.error('Migration:',e.message);return respond(res,409,{erro:e.message});}
 }
 if(scope==='import')return respond(res,403,{erro:'Escopo invalido.'});
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
