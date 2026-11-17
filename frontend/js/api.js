(function () {
  function usuarioAtual(valor) {
    if (valor) localStorage.setItem('spawnly.usuario',JSON.stringify(valor));
    try {return JSON.parse(localStorage.getItem('spawnly.usuario')||'null');}catch {return null;}
  }
  async function api(caminho,opcoes={}) {
    const method=(opcoes.method||'GET').toUpperCase();
    const headers={'Content-Type':'application/json',...(opcoes.headers||{})};
    const usuario=usuarioAtual();
    if(usuario&&usuario.token)headers['x-spawnly-user-token']=usuario.token;
    const modificandoSeed=/^\/seeds(?:\/\d+)?$/.test(caminho)&&['POST','PUT','DELETE'].includes(method);
    if(modificandoSeed){
      let chave=sessionStorage.getItem('spawnly.admin-key');
      if(!chave)chave=window.prompt('Digite a chave administrativa para alterar seeds:');
      if(!chave)throw new Error('Chave administrativa necessaria para alterar seeds.');
      sessionStorage.setItem('spawnly.admin-key',chave);
      headers['x-spawnly-admin-key']=chave;
    }
    const resposta=await fetch('/api'+caminho,{...opcoes,headers});
    const dados=await resposta.json().catch(()=>({}));
    if(!resposta.ok){
      if(modificandoSeed&&resposta.status===401)sessionStorage.removeItem('spawnly.admin-key');
      throw new Error(dados.erro||'Erro HTTP '+resposta.status);
    }
    return dados;
  }
  function selecionados(container){return [...container.querySelectorAll('input:checked')].map(input=>input.value);}
  function renderizarOpcoes(container,itens,nome){
    container.replaceChildren(...itens.map(item=>{
      const label=document.createElement('label'), input=document.createElement('input');
      input.type='checkbox';input.name=nome;input.value=item.slug;
      label.append(input,document.createTextNode(item.nome));return label;
    }));
  }
  window.Spawnly={api,usuarioAtual,selecionados,renderizarOpcoes};
}());
