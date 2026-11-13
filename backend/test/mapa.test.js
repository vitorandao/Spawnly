const test = require('node:test');
const assert = require('node:assert/strict');
const { validarParametros, gerarMapa } = require('../services/mapa');

test('aceita seed negativa e coordenadas validas', () => {
    assert.deepEqual(validarParametros({ seed: '-123456789', versao: '1.21.11', x: '-64', z: '32' }),
        { seed: '-123456789', versao: '1.21.11', x: -64, z: 32 });
});
test('rejeita versao nao permitida e valores fora dos limites', () => {
    assert.equal(validarParametros({ seed: '1', versao: '1.22' }), null);
    assert.equal(validarParametros({ seed: '1', x: '1000001' }), null);
    assert.equal(validarParametros({ seed: 'abc' }), null);
});
test('chama gerador usando argumentos separados', async () => {
    const mock = async (bin, args, opts) => {
        assert.ok(bin.includes('gerar_mapa'));
        assert.deepEqual(args, ['42', '1.21.1', '0', '-16']);
        assert.equal(opts.timeout, 12000);
        return { stdout: JSON.stringify({
            largura: 96, altura: 96, biomas: Array(9216).fill(1),
            paleta: Array(256).fill([0, 0, 0])
        }) };
    };
    const result = await gerarMapa({ seed: '42', versao: '1.21.1', x: 0, z: -16 }, mock);
    assert.equal(result.biomas.length, 9216);
});
