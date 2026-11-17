'use strict';
const {bridge,constantTimeEqual}=require('./_bridge');
const ROUTES=new Set(['status','usuarios','seeds','preferencias','recomendar','catalogos']);
module.exports=async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 const route=String(req.query?.route||'');
 if(!ROUTES.has(route))return res.status(404).json({erro:'Rota nao encontrada'});
 const method=req.method.toUpperCase();
 const id=req.query?.id;
 const adminMutation=route==='seeds'&&['POST','PUT','DELETE'].includes(method);
 let scope='user';
 if(adminMutation){
  if(!process.env.SPAWNLY_ADMIN_KEY)return res.status(503).json({erro:'Chave administrativa ausente'});
  if(!constantTimeEqual(req.headers['x-spawnly-admin-key'],process.env.SPAWNLY_ADMIN_KEY))
   return res.status(401).json({erro:'Chave administrativa incorreta'});
  scope='admin';
 }
 try{
  const params={route,...(id!=null?{id}:{}),...(req.query?.usuario_id!=null?{usuario_id:req.query.usuario_id}:{})};
  const userToken=String(req.headers['x-spawnly-user-token']||'');
  const raw=method==='GET'?null:(typeof req.body==='string'?JSON.parse(req.body):req.body||{});
  const upstream=await bridge({method,params,body:raw,scope,userToken,oidcToken:String(req.headers['x-vercel-oidc-token']||'')});
  return res.status(upstream.status).json(upstream.data);
 }catch(e){
  console.error('Render integration:',e.name,e.message?.slice(0,160));
  return res.status(Number(e.status)||503).json({erro:'Nao foi possivel acessar o PostgreSQL do Render.'});
 }
};
