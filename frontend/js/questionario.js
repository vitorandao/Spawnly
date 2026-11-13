const { api, renderizarOpcoes, selecionados, usuarioAtual } = window.Spawnly;
let usuario = usuarioAtual();
const campoNome = document.querySelector('#nome');
const jogadorAtual = document.querySelector('#jogador-atual');
const mensagem = document.querySelector('#mensagem');
let catalogos;

if (!usuario && !campoNome) location.href = 'index.html';

function marcar(container, valores = []) {
    for (const input of container.querySelectorAll('input')) input.checked = valores.includes(input.value);
}

function atualizarVersoes() {
    const edicao = document.querySelector('#edicao').value;
    const lista = document.querySelector('#lista-versoes');
    const opcoes = catalogos.versoes.filter(item => item.edicao === edicao || item.edicao === 'Ambas');
    lista.replaceChildren(...opcoes.map(item => new Option(item.versao_texto)));
}

// Converte o nome escolhido para o slug usado pela API.
function slugBioma(nome) {
    return nome.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}

// Mostra somente os biomas da dimensão selecionada.
function mostrarBiomas(dimensao) {
    for (const grupo of document.querySelectorAll('.grupo-biomas')) {
        grupo.hidden = grupo.dataset.grupoDimensao !== dimensao;
    }
}

async function iniciar() {
    if (jogadorAtual && usuario) jogadorAtual.textContent = `Jogador: ${usuario.nome}`;
    if (usuario) {
        if (campoNome) campoNome.value = usuario.nome;
        document.querySelector('#edicao').value = usuario.edicao;
        document.querySelector('#versao').value = usuario.versao;
    }
    try {
        [catalogos] = await Promise.all([api('/catalogos')]);
        mostrarBiomas('superficie');
        renderizarOpcoes(document.querySelector('#opcoes-estruturas'), catalogos.estruturas, 'estrutura');
        renderizarOpcoes(document.querySelector('#opcoes-estilos'), catalogos.estilos, 'estilo');
        atualizarVersoes();
        const preferencias = usuario ? await api(`/preferencias?usuario_id=${usuario.id}`) : [];
        if (preferencias[0]) {
            const p = preferencias[0];
            const biomaSalvo = [...document.querySelectorAll('input[name="bioma"]')]
                .find(input => slugBioma(input.value) === p.biomas[0]);
            if (biomaSalvo) {
                biomaSalvo.checked = true;
                const dimensao = biomaSalvo.closest('.grupo-biomas').dataset.grupoDimensao;
                document.querySelector(`[name="dimensao-bioma"][data-dimensao="${dimensao}"]`).checked = true;
                mostrarBiomas(dimensao);
            }
            marcar(document.querySelector('#opcoes-estruturas'), p.estruturas);
            marcar(document.querySelector('#opcoes-estilos'), p.estilos);
            const pesoBioma = document.querySelector('#peso-bioma');
            const pesoEstrutura = document.querySelector('#peso-estrutura');
            const pesoEstilo = document.querySelector('#peso-estilo');
            if (pesoBioma) pesoBioma.value = p.pesos.bioma;
            if (pesoEstrutura) pesoEstrutura.value = p.pesos.estrutura;
            if (pesoEstilo) pesoEstilo.value = p.pesos.estilo;
        }
    } catch (erro) { mensagem.textContent = erro.message; }
}

for (const radio of document.querySelectorAll('input[name="dimensao-bioma"]')) {
    radio.addEventListener('change', () => mostrarBiomas(radio.value));
}

document.querySelector('#edicao').addEventListener('change', atualizarVersoes);
document.querySelector('#form-questionario').addEventListener('submit', async evento => {
    evento.preventDefault(); mensagem.textContent = '';
    // O rádio marcado vira o único bioma enviado para as recomendações.
    const bioma = document.querySelector('input[name="bioma"]:checked');
    const biomas = bioma ? [slugBioma(bioma.value)] : [];
    const estruturas = selecionados(document.querySelector('#opcoes-estruturas'));
    const estilos = selecionados(document.querySelector('#opcoes-estilos'));
    if (biomas.length === 0 || estilos.length === 0) {
        mensagem.textContent = 'Escolha um bioma e um estilo de jogo.'; return;
    }
    const botao = evento.submitter; botao.disabled = true;
    try {
        const dadosUsuario = {
            nome: campoNome ? campoNome.value : usuario ? usuario.nome : 'Jogador',
            edicao: document.querySelector('#edicao').value,
            versao: document.querySelector('#versao').value
        };
        const salvo = usuario
            ? await api(`/usuarios/${usuario.id}`, { method: 'PUT', body: JSON.stringify(dadosUsuario) })
            : await api('/usuarios', { method: 'POST', body: JSON.stringify(dadosUsuario) });
        usuario = usuarioAtual(salvo);
        await api('/preferencias', { method: 'POST', body: JSON.stringify({
            usuario_id: usuario.id, biomas, estruturas, estilos,
            pesos: {
                bioma: Number(document.querySelector('#peso-bioma')?.value || 2),
                estrutura: Number(document.querySelector('#peso-estrutura')?.value || 2),
                estilo: Number(document.querySelector('#peso-estilo')?.value || 2)
            }
        }) });
        const resultado = await api('/recomendar', { method: 'POST', body: JSON.stringify({ usuario_id: usuario.id }) });
        sessionStorage.setItem('spawnly.recomendacoes', JSON.stringify(resultado));
        location.href = 'resultados.html';
    } catch (erro) { mensagem.textContent = erro.message; }
    finally { botao.disabled = false; }
});

iniciar();
