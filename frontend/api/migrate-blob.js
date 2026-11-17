'use strict';
const {read}=require('./_store');
const {bridge}=require('./_bridge');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(process.env.VERCEL_ENV!=='preview'||req.method!=='GET')
  return res.status(404).json({erro:'Nao encontrado'});
 try{
  const {state}=await read();
  const r=await bridge({method:'POST',path:'/internal/import',body:state,scope:'import',oidcToken:String(req.headers['x-vercel-oidc-token']||'')});
  return res.status(r.status).json(r.data);
 }catch(e){
  console.error('Migration:',e.message?.slice(0,180));
  return res.status(503).json({erro:'Nao foi possivel migrar dados para PostgreSQL.'});
 }
};
