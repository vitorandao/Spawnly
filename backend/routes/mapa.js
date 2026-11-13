const express = require('express');
const { gerarMapa, validarParametros } = require('../services/mapa');

module.exports = function criarRotasMapa() {
    const router = express.Router();
    router.get('/', async (req, res) => {
        const params = validarParametros(req.query);
        if (!params) {
            return res.status(400).json({ erro: 'Seed, versao ou coordenadas invalidas. Apenas Java e suportado.' });
        }
        try {
            res.set('Cache-Control', 'public, max-age=3600');
            res.json(await gerarMapa(params));
        } catch (erro) {
            console.error('Falha ao gerar mapa:', erro.code || erro.message);
            res.status(503).json({
                erro: 'Gerador de mapa indisponivel. Compile o Cubiomes conforme backend/native/README.md.'
            });
        }
    });
    return router;
};
