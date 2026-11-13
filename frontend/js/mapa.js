
const form = document.querySelector('#form-mapa');
const msg = document.querySelector('#mensagem-mapa');
const status = document.querySelector('#status-mapa');
const canvas = document.querySelector('#canvas-mapa');
const ctx = canvas.getContext('2d');
const coordenadas = document.querySelector('#coordenadas-mapa');
const button = document.querySelector('#gerar-mapa');
let dadosAtuais = null;
let carregando = false;

function pintar(dados) {
    const { largura, altura, biomas, paleta } = dados;
    const auxiliar = document.createElement('canvas');
    auxiliar.width = largura;
    auxiliar.height = altura;
    const contexto = auxiliar.getContext('2d');
    const imagem = contexto.createImageData(largura, altura);
    for (let i = 0; i < biomas.length; i++) {
        const cor = paleta[biomas[i]] || [125, 125, 125];
        const pos = i * 4;
        imagem.data[pos] = cor[0];
        imagem.data[pos + 1] = cor[1];
        imagem.data[pos + 2] = cor[2];
        imagem.data[pos + 3] = 255;
    }
    contexto.putImageData(imagem, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(auxiliar, 0, 0, canvas.width, canvas.height);
}
async function carregar() {
    if (carregando) return;
    if (document.querySelector('#edicao-mapa').value !== 'Java') {
        msg.textContent = 'Somente Minecraft Java e suportado.';
        return;
    }
    const seed = document.querySelector('#codigo-seed').value.trim();
    const versao = document.querySelector('#versao-mapa').value;
    const x = Number(document.querySelector('#centro-x').value);
    const z = Number(document.querySelector('#centro-z').value);
    if (!/^-?\d{1,19}$/.test(seed) || !Number.isInteger(x) || !Number.isInteger(z)) {
        msg.textContent = 'Informe seed numerica e coordenadas inteiras.';
        return;
    }
    carregando = true;
    button.disabled = true;
    msg.textContent = 'Gerando biomas...';
    try {
        const query = new URLSearchParams({ seed, versao, x: String(x), z: String(z) });
        const dados = await window.Spawnly.api('/mapa?' + query);
        dadosAtuais = dados;
        pintar(dados);
        msg.textContent = '';
        status.textContent = 'Mapa carregado. Area de ' + (dados.largura * dados.escala) +
            ' × ' + (dados.altura * dados.escala) + ' blocos.';
        coordenadas.textContent = 'X: ' + x + ' | Z: ' + z;
        const url = new URL(window.location);
        url.search = query.toString();
        history.replaceState(null, '', url);
    } catch (erro) {
        msg.textContent = erro.message;
        status.textContent = 'Nao foi possivel carregar o mapa.';
    } finally {
        carregando = false;
        button.disabled = false;
    }
}
form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    carregar();
});
for (const [id, dx, dz] of [
    ['mapa-esquerda', -384, 0], ['mapa-direita', 384, 0],
    ['mapa-cima', 0, -384], ['mapa-baixo', 0, 384]
]) {
    document.querySelector('#' + id).addEventListener('click', () => {
        if (!document.querySelector('#codigo-seed').value.trim() || carregando) return;
        const x = document.querySelector('#centro-x');
        const z = document.querySelector('#centro-z');
        x.value = String(Math.max(-1000000, Math.min(1000000, Number(x.value) + dx)));
        z.value = String(Math.max(-1000000, Math.min(1000000, Number(z.value) + dz)));
        carregar();
    });
}
canvas.addEventListener('mousemove', (evento) => {
    if (!dadosAtuais) return;
    const rect = canvas.getBoundingClientRect();
    const px = Math.max(0, Math.min(dadosAtuais.largura - 1,
        Math.floor((evento.clientX - rect.left) / rect.width * dadosAtuais.largura)));
    const pz = Math.max(0, Math.min(dadosAtuais.altura - 1,
        Math.floor((evento.clientY - rect.top) / rect.height * dadosAtuais.altura)));
    const x = dadosAtuais.origem.x + px * dadosAtuais.escala;
    const z = dadosAtuais.origem.z + pz * dadosAtuais.escala;
    const biome = dadosAtuais.biomas[pz * dadosAtuais.largura + px];
    coordenadas.textContent = 'X: ' + x + ' | Z: ' + z + ' | Bioma ID: ' + biome;
});
const query = new URLSearchParams(location.search);
const seed = query.get('seed');
if (seed) {
    document.querySelector('#codigo-seed').value = seed;
    const versao = query.get('versao');
    if ([...document.querySelector('#versao-mapa').options].some(o => o.value === versao)) {
        document.querySelector('#versao-mapa').value = versao;
    }
    if (query.get('x') !== null) document.querySelector('#centro-x').value = query.get('x');
    if (query.get('z') !== null) document.querySelector('#centro-z').value = query.get('z');
    carregar();
}
