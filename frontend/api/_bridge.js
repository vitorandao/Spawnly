'use strict';
const crypto=require('node:crypto');
function constantTimeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
async function bridge({method='GET',path='/api/backend',params={},body=null,scope='user',userToken=''}) {
 const rawUrl=process.env.SPAWNLY_RENDER_API_URL;
 const privateKey=process.env.SPAWNLY_PG_PRIVATE_KEY;
 if(!rawUrl||!privateKey){
  const e=new Error('Integracao PostgreSQL nao configurada.');e.status=503;throw e;
 }
 const base=new URL(rawUrl);
 if(base.protocol!=='https:'||!base.hostname.endsWith('.onrender.com'))throw new Error('Render URL invalida.');
 const url=new URL(path,base);
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));
 const bodyText=body===null?'':JSON.stringify(body);
 const timestamp=String(Date.now()),nonce=crypto.randomBytes(16).toString('hex');
 const payload=JSON.stringify([timestamp,nonce,method,url.pathname+url.search,scope,userToken,bodyText]);
 const signature=crypto.sign(null,Buffer.from(payload),privateKey.replace(/\\n/g,'\n')).toString('base64');
 const headers={
   'content-type':'application/json',
   'x-spawnly-timestamp':timestamp,
   'x-spawnly-nonce':nonce,
   'x-spawnly-signature':signature,
   'x-spawnly-scope':scope,
   'x-spawnly-user-token':userToken
 };
 const rsp=await fetch(url.toString(),{method,headers,...(bodyText?{body:bodyText}:{}),signal:AbortSignal.timeout(50000)});
 const result=await rsp.json().catch(()=>({erro:'Resposta invalida do Render'}));
 return {status:rsp.status,data:result};
}
module.exports={bridge,constantTimeEqual};
