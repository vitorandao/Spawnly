const { api } = window.Spawnly;
const statusApi = document.querySelector('#status-api');

async function iniciar() {
    try {
        const status = await api('/status');
        statusApi.textContent = `${status.aplicacao}: servidor e banco conectados.`;
        statusApi.classList.add('ok');
    } catch (erro) {
        statusApi.textContent = erro.message;
        statusApi.classList.add('erro');
    }
}

iniciar();
