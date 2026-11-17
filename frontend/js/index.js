const { api, usuarioAtual } = window.Spawnly;
const statusApi=document.querySelector('#status-api');
const formulario=document.querySelector('#form-questionario');
const mensagem=document.querySelector('#mensagem');
const nome=document.querySelector('#nome-jogador');
let catalogo=null;
function estiloValido(s){
 const mapa={adventure:'exploracao',spectator:'criativo',creative:'criativo',survival:'survival_tradicional'};
 const valor=mapa[s]||s;
 return catalogo?.estilos.some(x=>x.slug===valor)?valor:'exploracao';
}
async function iniciar(){
 const antigo=usuarioAtual();
 if(antigo?.nome)nome.value=antigo.nome;
 try{
   const [status,c]=await Promise.all([api('/status'),api('/catalogos')]);
   catalogo=c;
   statusApi.textContent=status.aplicacao+': dados persistentes disponiveis.';
   statusApi.classList.add('ok');
 }catch(e){
   statusApi.textContent=e.message;statusApi.classList.add('erro');
 }
}
formulario.addEventListener('submit',async evento=>{
 evento.preventDefault();mensagem.textContent='';
 const btn=evento.submitter; if(btn)btn.disabled=true;
 try{
   if(!catalogo)catalogo=await api('/catalogos');
   const edicao=document.querySelector('#edicao').value, versao=document.querySelector('#versao').value.trim();
   const bioma=document.querySelector('input[name="bioma"]:checked');
   const estilo=document.querySelector('input[name="estilo"]:checked');
   if(!bioma||!estilo)throw new Error('Escolha um bioma e um estilo de jogo.');
   const validas=new Set(catalogo.estruturas.map(x=>x.slug));
   const estruturas=[...document.querySelectorAll('input[name="estrutura"]:checked')].map(x=>x.value.replaceAll('-','_')).filter(x=>validas.has(x));
   const dadosUsuario={nome:nome.value.trim(),edicao,versao};
   const anterior=usuarioAtual();
   const usuario=anterior?.id&&anterior?.token&&anterior.nome===dadosUsuario.nome?
    await api('/usuarios/'+anterior.id,{method:'PUT',body:JSON.stringify(dadosUsuario)}):
    await api('/usuarios',{method:'POST',body:JSON.stringify(dadosUsuario)});
   usuarioAtual(usuario);
   await api('/preferencias',{method:'POST',body:JSON.stringify({
      usuario_id:usuario.id,biomas:[bioma.value],estruturas,estilos:[estiloValido(estilo.value)],
      pesos:{bioma:2,estrutura:2,estilo:2}
   })});
   const resultado=await api('/recomendar',{method:'POST',body:JSON.stringify({usuario_id:usuario.id})});
   sessionStorage.setItem('spawnly.recomendacoes',JSON.stringify(resultado));
   location.href='resultados.html';
 }catch(e){mensagem.textContent=e.message;}finally{if(btn)btn.disabled=false;}
});
iniciar();
