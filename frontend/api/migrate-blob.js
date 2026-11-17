'use strict';
const crypto=require('node:crypto');
const {read}=require('./_store');
const {bridge}=require('./_bridge');
const expected='f2bcd0fea5fe362317587645a32795f09c932b6d13a64e2cde9a2e711fc734da';
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const token=typeof req.query?.token==='string'?req.query.token:'';
 const digest=crypto.createHash('sha256').update(token).digest('hex');
 if(process.env.VERCEL_ENV!=='preview'||
    process.env.VERCEL_GIT_COMMIT_REF!=='feature/spawnly-render-postgres-integration-20261117'||
    req.method!=='GET'||!token||
    !crypto.timingSafeEqual(Buffer.from(digest),Buffer.from(expected)))
   return res.status(404).json({erro:'Nao encontrado'});
 try{
  const {state}=await read();
  const reply=await bridge({method:'POST',path:'/internal/import',body:state,scope:'import',oidcToken:String(req.headers['x-vercel-oidc-token']||'')});
  return res.status(reply.status).json(reply.data);
 }catch(e){
  console.error('Blob migration failed:',e.name,e.message?.slice(0,170));
  return res.status(503).json({erro:'Falha na migracao para PostgreSQL.'});
 }
};