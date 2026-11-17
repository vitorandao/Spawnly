'use strict';
/*
 * Executar manualmente UMA VEZ para um banco MySQL/MariaDB hospedado e vazio.
 * NUNCA executar como parte do build/deploy da Vercel.
 * Definir DB_HOST DB_USER DB_PASSWORD DB_NAME DB_SSL e DB_SETUP_CONFIRM.
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { biomasMinecraft } = require('../data/biomas-minecraft');

async function main() {
  const banco = process.env.DB_NAME;
  if (banco !== 'spawnly_integracao' || process.env.DB_SETUP_CONFIRM !== banco) {
    throw new Error('Confirmacao obrigatoria: DB_NAME=spawnly_integracao e DB_SETUP_CONFIRM=spawnly_integracao');
  }
  for (const nome of ['DB_HOST', 'DB_USER', 'DB_PASSWORD']) {
    if (!process.env[nome]) throw new Error('Falta a variavel: ' + nome);
  }
  const ssl = ['1', 'true', 'required'].includes(String(process.env.DB_SSL || '').toLowerCase())
    ? { rejectUnauthorized: true } : undefined;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: banco, ssl, multipleStatements: true,
    connectTimeout: 10000
  });
  try {
    const [existentes] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    if (existentes.length) {
      throw new Error('Banco remoto nao esta vazio. Importacao cancelada para preservar os dados existentes.');
    }
    let script = fs.readFileSync(path.resolve(__dirname, '../../database/spawnly_mariadb.sql'), 'utf8');
    script = script
      .replace(/^CREATE DATABASE IF NOT EXISTS [^\n]*\n/gm, '')
      .replace(/^USE .+;\s*$/gm, '');
    await conn.query(script);
    await conn.query(
      'INSERT IGNORE INTO biomas (slug, nome) VALUES ?',
      [biomasMinecraft.map(({slug,nome})=>[slug,nome])]
    );
    const [[resumo]] = await conn.query(
      'SELECT (SELECT COUNT(*) FROM seeds) seeds, (SELECT COUNT(*) FROM biomas) biomas, ' +
      '(SELECT COUNT(*) FROM estruturas) estruturas'
    );
    console.log('Importacao concluida:', resumo);
  } finally {
    await conn.end();
  }
}
main().catch(erro => {console.error('Falha ao preparar banco remoto:', erro.message);process.exitCode=1;});
