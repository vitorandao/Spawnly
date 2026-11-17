require('dotenv').config();
const mysql = require('mysql2/promise');

const obrigatorias = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_NAME'];
const ausentes = obrigatorias.filter(nome => !process.env[nome]);
if (ausentes.length) {
    throw new Error('Variaveis de banco ausentes: ' + ausentes.join(', '));
}

const porta = Number(process.env.DB_PORT || 3306);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error('DB_PORT invalida.');
}
const ssl = ['1', 'true', 'required'].includes(
    String(process.env.DB_SSL || '').toLowerCase()
) ? { rejectUnauthorized: true } : undefined;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: porta,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl,
    waitForConnections: true,
    connectionLimit: 2, // limita conexoes em cada instancia serverless
    queueLimit: 50,
    connectTimeout: 10000,
    supportBigNumbers: true,
    bigNumberStrings: true,
    charset: 'utf8mb4'
});
module.exports = pool;
