const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { biomasMinecraft } = require('../data/biomas-minecraft');

test('catalogo tem os biomas Java 1.21 das tres dimensoes', () => {
    assert.equal(biomasMinecraft.filter(bioma => bioma.dimensao === 'overworld').length, 54);
    assert.equal(biomasMinecraft.filter(bioma => bioma.dimensao === 'nether').length, 5);
    assert.equal(biomasMinecraft.filter(bioma => bioma.dimensao === 'end').length, 5);
    assert.equal(new Set(biomasMinecraft.map(bioma => bioma.slug)).size, biomasMinecraft.length);
});

for (const arquivo of ['index.html', 'questionario.html']) {
    test(`${arquivo} usa radios unicos para cada bioma`, () => {
        const html = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', arquivo), 'utf8');
        const radios = [...html.matchAll(/<input type="radio" name="bioma" id="([^"]+)" value="([^"]+)"([^>]*)>/g)];
        const ids = radios.map(([, id]) => id);
        assert.equal(radios.length, biomasMinecraft.length);
        assert.equal(new Set(ids).size, ids.length);
        assert.ok(radios.some(([, id, nome, atributos]) =>
            id === 'bioma-overworld-plains' && nome === 'plains' && /\bchecked\b/.test(atributos)));
        assert.deepEqual(radios.map(([, , slug]) => slug),
            biomasMinecraft.map(bioma => bioma.nome.toLowerCase().replaceAll(' ', '-')));
        assert.equal((html.match(/<img src="biomas\/[^"]+\.png" alt="[^"]+">/g) || []).length, radios.length);
    });
}
