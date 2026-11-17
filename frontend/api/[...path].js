'use strict';
/**
 * Adaptador do Express da aplicacao Spawnly para Vercel Functions.
 * Mantem as rotas e consultas MySQL originais, sem recriar os endpoints.
 * Banco remoto deve ser configurado apenas no painel da Vercel.
 */
let app;
module.exports = async function handler(req, res) {
  const faltando = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter(
    key => !process.env[key]
  );
  res.setHeader('Cache-Control', 'no-store');
  if (faltando.length) {
    return res.status(503).json({
      erro: 'Banco de dados ainda nao configurado na hospedagem.',
      status: 'indisponivel',
      codigo: 'DATABASE_NOT_CONFIGURED'
    });
  }
  try {
    if (!app) {
      const db = require('../backend/config/db');
      const { criarApp } = require('../backend/server');
      app = criarApp(db);
    }
    return app(req, res);
  } catch (erro) {
    console.error('Falha ao iniciar API Spawnly:', erro.code || erro.message);
    if (!res.headersSent) {
      return res.status(503).json({
        erro: 'Servico de banco indisponivel.',
        codigo: 'BACKEND_STARTUP_FAILED'
      });
    }
    return undefined;
  }
};
