'use strict';
const backend=require('./backend');
const crypto=require('node:crypto');
function assert(ok,msg){if(!ok)throw new Error(msg);}
function call(route,method,body,headers={},id){
  const req={query:{route,...(id?{id:String(id)}:{})},method,body,headers};
  const res={statusCode:200,setHeader(){},status(c){this.statusCode=c;return this;},
    json(data){return {status:this.statusCode, data};}};
  return backend(req,res);
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(process.env.VERCEL_ENV!=='preview')return res.status(404).json({erro:'Indisponivel'});
 if(req.method!=='GET')return res.status(405).json({erro:'Metodo nao permitido.'});
 if(req.query?.cleanup==='1'){
   try{
     const {read,transact}=require('./_store');
     const before=(await read()).state;
     const ids=new Set(before.usuarios.filter(x=>x.nome?.startsWith('Teste Integracao ')).map(x=>x.id));
     const old=before.seeds||[];
     const count=old.filter(x=>/^(Seed de teste |Seed atualizada )/.test(x.nome||'')).length;
     await transact(s=>{
       s.usuarios=s.usuarios.filter(x=>!ids.has(x.id));
       for(const id of ids)delete s.preferencias[id];
       if(s.seeds)s.seeds=s.seeds.filter(x=>!/^(Seed de teste |Seed atualizada )/.test(x.nome||''));
       return null;
     });
     const after=(await read()).state;
     return res.status(200).json({status:'limpo',usuariosRemovidos:ids.size,seedsRemovidas:count,restantes:{usuarios:after.usuarios.length,seeds:after.seeds?.length??90}});
   }catch(e){return res.status(500).json({status:'erro_limpeza',erro:String(e.message).slice(0,300)});}
 }
 const checks=[],tokenHeaders={},adminHeaders={'x-spawnly-admin-key':process.env.SPAWNLY_ADMIN_KEY};
 let uid=null,sid=null;
 try{
  let r=await call('status','GET');
  assert(r.status===200&&r.data.armazenamento==='Vercel Blob privado','status '+r.status);
  checks.push('status');
  const unique=crypto.randomBytes(5).toString('hex');
  r=await call('usuarios','POST',{nome:'Teste Integracao '+unique,edicao:'Java',versao:'1.21.4'});
  assert(r.status===201&&r.data.id&&r.data.token,'cadastro '+r.status+' '+JSON.stringify(r.data));
  uid=r.data.id;tokenHeaders['x-spawnly-user-token']=r.data.token;checks.push('criar-usuario');
  r=await call('usuarios','GET');
  assert(r.status===200&&r.data.some(x=>x.id===uid),'listar-usuario');
  checks.push('listar-usuario');
  r=await call('preferencias','POST',{usuario_id:uid,biomas:['planicies'],estruturas:['village'],estilos:['survival_tradicional'],pesos:{bioma:2,estrutura:2,estilo:2}},tokenHeaders);
  assert(r.status===201,'preferencias '+r.status+' '+JSON.stringify(r.data));checks.push('salvar-preferencias');
  r=await call('preferencias','GET',undefined,{},undefined);
  assert(r.status===200&&r.data.some(x=>x.usuario_id===uid),'ler-preferencias');checks.push('ler-preferencias');
  r=await call('recomendar','POST',{usuario_id:uid},tokenHeaders);
  assert(r.status===200&&r.data.total>0&&r.data.recomendacoes.some(x=>x.pontuacao>0),'recomendacoes '+r.status);
  checks.push('recomendar');
  const codigo=String(80000000000000 + Number(BigInt('0x'+crypto.randomBytes(5).toString('hex'))));
  const seed={codigo,nome:'Seed de teste '+unique,edicao_versao_id:1,
    biomas:['planicies'],estruturas:['village'],spawn_texto:'0,0',nota:'Teste isolado'};
  r=await call('seeds','POST',seed,adminHeaders);
  assert(r.status===201&&r.data.id,'criar-seed '+r.status+' '+JSON.stringify(r.data));sid=r.data.id;checks.push('criar-seed');
  r=await call('seeds','GET');assert(r.status===200&&r.data.some(x=>x.id===sid),'listar-seed');
  checks.push('listar-seed');
  r=await call('seeds','PUT',{...seed,nome:'Seed atualizada '+unique},adminHeaders,sid);
  assert(r.status===200,'editar-seed '+r.status+' '+JSON.stringify(r.data));checks.push('editar-seed');
  r=await call('seeds','GET');assert(r.status===200&&r.data.find(x=>x.id===sid)?.nome.includes('atualizada'),'persistencia-seed');
  checks.push('persistencia-seed');
  return res.status(200).json({status:'passou',checks});
 }catch(e){return res.status(500).json({status:'falhou',checks,erro:String(e.message).slice(0,400)});}
 finally{
  if(sid){try{await call('seeds','DELETE',undefined,adminHeaders,sid)}catch(e){console.error('cleanup seed:',e.message)}}
  if(uid){try{await call('usuarios','DELETE',undefined,tokenHeaders,uid)}catch(e){console.error('cleanup user:',e.message)}}
 }
};
