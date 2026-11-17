'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path');

const VERSOES = new Set(['1.20.6', '1.21.1', '1.21.4', '1.21.11']);
const LIMITE = 1000000;
const MAX_SEED = 9223372036854775807n;
const MIN_SEED = -9223372036854775808n;

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Metodo nao permitido.' });
  }
  const { seed, versao = '1.21.11', x = '0', z = '0' } = req.query || {};
  const s = String(seed ?? '');
  const versaoTexto = String(versao);
  const xx = Number(x), zz = Number(z);
  if (!/^-?\d{1,19}$/.test(s) || !VERSOES.has(versaoTexto) ||
      !Number.isInteger(xx) || !Number.isInteger(zz) ||
      Math.abs(xx) > LIMITE || Math.abs(zz) > LIMITE ||
      BigInt(s) < MIN_SEED || BigInt(s) > MAX_SEED) {
    return res.status(400).json({ erro: 'Seed, versao ou coordenadas invalidas. Apenas Java e suportado.' });
  }
  const binary = path.join(__dirname, '..', 'native', 'gerar_mapa');
  execFile(binary, [s, versaoTexto, String(xx), String(zz)],
    { timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true },
    (error, stdout) => {
      if (error) {
        console.error('Erro no Cubiomes:', error.code || error.message);
        return res.status(503).json({ erro: 'Gerador de biomas indisponivel no servidor.' });
      }
      try {
        const dados = JSON.parse(stdout);
        if (dados.largura !== 96 || dados.altura !== 96 ||
            !Array.isArray(dados.biomas) || dados.biomas.length !== 9216 ||
            !Array.isArray(dados.paleta) || dados.paleta.length !== 256) {
          throw new Error('Saida invalida do Cubiomes');
        }
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
        return res.status(200).json(dados);
      } catch (parseError) {
        console.error('Cubiomes output:', parseError.message);
        return res.status(503).json({ erro: 'Resposta invalida do gerador de biomas.' });
      }
    });
};
