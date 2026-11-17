'use strict';
const { get, put, list } = require('@vercel/blob');
const PREFIX = 'spawnly/estado-v2-';
function emptyState() { return { revision: 0, usuarios: [], preferencias: {}, seeds: null }; }
async function read() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Armazenamento nao configurado.');
  let cursor, latestRev=0, latestPath=null;
  do {
    const page=await list({prefix:PREFIX,limit:1000,...(cursor?{cursor}:{})});
    for(const blob of page.blobs||[]){
      const match=blob.pathname.match(/estado-v2-(\d+)\.json$/);
      if(match){const n=Number(match[1]);if(Number.isSafeInteger(n)&&n>latestRev){latestRev=n;latestPath=blob.pathname;}}
    }
    cursor=page.hasMore?page.cursor:null;
  }while(cursor);
  if(!latestPath)return {state:emptyState(),revision:0};
  const data=await get(latestPath,{access:'private'});
  if(!data||data.statusCode!==200||!data.stream)throw new Error('Falha ao ler estado persistente.');
  const state=JSON.parse(await new Response(data.stream).text());
  if(!state||!Array.isArray(state.usuarios)||!state.preferencias||state.revision!==latestRev)
    throw new Error('Estado persistente inconsistente.');
  return {state,revision:latestRev};
}
async function transact(mutator) {
  for(let attempt=0;attempt<8;attempt++){
    const {state,revision}=await read();
    const working=structuredClone(state);
    const result=await mutator(working);
    working.revision=revision+1;
    const filename=PREFIX+String(working.revision).padStart(10,'0')+'.json';
    try{
      await put(filename,JSON.stringify(working),{access:'private',contentType:'application/json',addRandomSuffix:false});
      return result;
    }catch(error){
      if(!/already.exists|precondition|conflict|409|412/i.test(String(error?.name)+' '+String(error?.message)))throw error;
    }
  }
  const error=new Error('Alteracao simultanea: tente novamente.');error.status=409;throw error;
}
module.exports={read,transact};
