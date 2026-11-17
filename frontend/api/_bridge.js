'use strict';
const crypto=require('node:crypto');
function constantTimeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
async function bridge({method='GET',path='/api/backend',params={},body=null,scope='user',userToken='',oidcToken=''}) {
 const rawUrl=process.env.SPAWNLY_RENDER_API_URL;
 if(!rawUrl){const e=new Error('Render URL nao configurada.');e.status=503;throw e;}
 if(typeof oidcToken!=='string'||!oidcToken.startsWith('eyJ')){const e=new Error('Vercel OIDC nao disponivel.');e.status=503;throw e;}
 const base=new URL(rawUrl);
 if(base.protocol!=='https:'||!base.hostname.endsWith('.onrender.com'))throw new Error('URL Render invalida.');
 const url=new URL(path,base);
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));
 const bodyText=body===null?'':JSON.stringify(body);
 const headers={
   'content-type':'application/json',
   'authorization':'Bearer '+oidcToken,
   'x-spawnly-scope':scope,
   'x-spawnly-user-token':userToken
 };
 const response=await fetch(url.toString(),{method,headers,...(bodyText?{body:bodyText}:{}),signal:AbortSignal.timeout(50000)});
 const data=await response.json().catch(()=>({erro:'Resposta invalida do Render'}));
 return {status:response.status,data};
}
module.exports={bridge,constantTimeEqual};
