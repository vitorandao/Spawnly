const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { codigoSeed } = require('../utils/validacao');

const execFileAsync = promisify(execFile);
const VERSOES = Object.freeze(['1.20.6', '1.21.1', '1.21.4', '1.21.11']);
const BINARIO = process.env.SPAWNLY_MAP_BINARY ||
    path.join(__dirname, '..', 'native', process.platform === 'win32' ? 'gerar_mapa.exe' : 'gerar_mapa');

function validarParametros(query) {
    const seed = codigoSeed(query.seed);
    const versao = String(query.versao || '1.21.11');
    const x = Number(query.x ?? 0);
    const z = Number(query.z ?? 0);
    if (!seed || !VERSOES.includes(versao) || !Number.isInteger(x) ||
        !Number.isInteger(z) || Math.abs(x) > 1000000 || Math.abs(z) > 1000000) {
        return null;
    }
    return { seed, versao, x, z };
}

async function gerarMapa(params, executor = execFileAsync) {
    const { stdout } = await executor(BINARIO, [
        params.seed, params.versao, String(params.x), String(params.z)
    ], { timeout: 12000, maxBuffer: 1024 * 1024 });
    const dados = JSON.parse(stdout);
    if (dados.largura !== 96 || dados.altura !== 96 ||
        !Array.isArray(dados.biomas) || dados.biomas.length !== 96 * 96 ||
        !Array.isArray(dados.paleta) || dados.paleta.length !== 256) {
        throw new Error('Resposta inesperada do gerador de biomas');
    }
    return dados;
}

module.exports = { validarParametros, gerarMapa, VERSOES };
