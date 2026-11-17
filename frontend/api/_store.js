'use strict';
const { get, put } = require('@vercel/blob');
const PATH = 'spawnly/state-v1.json';
function emptyState() { return { revision: 0, usuarios: [], preferencias: {}, seeds: null }; }
async function read() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Armazenamento nao configurado.');
  const result = await get(PATH, { access: 'private' });
  if (!result) return { state: emptyState(), etag: null };
  if (result.statusCode !== 200 || !result.stream) throw new Error('Falha na leitura persistente.');
  const data = JSON.parse(await new Response(result.stream).text());
  if (!data || !Array.isArray(data.usuarios) || typeof data.preferencias !== 'object') throw new Error('Estado persistente invalido.');
  return { state: data, etag: result.blob.etag };
}
async function transact(mutator) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { state, etag } = await read();
    const working = structuredClone(state);
    const result = await mutator(working);
    working.revision = (state.revision || 0) + 1;
    try {
      await put(PATH, JSON.stringify(working), {
        access: 'private', contentType: 'application/json',
        allowOverwrite: etag !== null, ...(etag ? { ifMatch: etag } : {})
      });
      return result;
    } catch (e) {
      if (!/precondition|already.exists|conflict|409|412/i.test(String(e?.name) + ' ' + String(e?.message))) throw e;
    }
  }
  const error = new Error('Registro alterado simultaneamente. Tente novamente.');
  error.status = 409;
  throw error;
}
module.exports = { read, transact };
