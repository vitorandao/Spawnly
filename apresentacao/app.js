
(function(){
  "use strict";
  const slides=[...document.querySelectorAll(".slide")];
  const count=slides.length;
  const prev=document.getElementById("prev");
  const next=document.getElementById("next");
  const label=document.getElementById("counter");
  const progress=document.getElementById("progress-bar");
  const noteBox=document.getElementById("notes");
  const noteText=document.getElementById("note-content");
  const overview=document.getElementById("overview");
  const grid=document.getElementById("overview-grid");
  let active=0;

  function show(index){
    active=Math.min(count-1,Math.max(0,index));
    slides.forEach((slide,i)=>{
      slide.classList.toggle("active",i===active);
      slide.setAttribute("aria-hidden",String(i!==active));
      if(i===active)slide.scrollTop=0;
    });
    label.textContent=(active+1)+" / "+count;
    progress.style.width=((active+1)*100/count)+"%";
    prev.disabled=active===0;
    next.disabled=active===count-1;
    noteText.textContent=slides[active].getAttribute("data-notes")||"";
    document.title="SPAWNLY | "+String(active+1).padStart(2,"0")+" / "+count+" — "+(slides[active].getAttribute("data-name")||"Apresentação");
    if(location.hash!=="#slide-"+(active+1)){
      try{history.replaceState(null,"","#slide-"+(active+1));}catch(e){location.hash="slide-"+(active+1);}
    }
  }
  function notes(force){
    noteBox.classList.toggle("visible",typeof force==="boolean"?force:!noteBox.classList.contains("visible"));
  }
  function index(force){
    overview.classList.toggle("visible",typeof force==="boolean"?force:!overview.classList.contains("visible"));
  }

  slides.forEach((slide,i)=>{
    const button=document.createElement("button");
    const num=document.createElement("small");
    num.textContent=String(i+1).padStart(2,"0");
    const title=document.createElement("b");
    title.textContent=slide.getAttribute("data-name")||"Slide";
    button.append(num,title);
    button.addEventListener("click",()=>{show(i);index(false);});
    grid.appendChild(button);
  });

  prev.addEventListener("click",()=>show(active-1));
  next.addEventListener("click",()=>show(active+1));
  document.getElementById("show-index").addEventListener("click",()=>index());
  document.getElementById("close-index").addEventListener("click",()=>index(false));
  document.getElementById("show-notes").addEventListener("click",()=>notes());
  document.getElementById("fullscreen").addEventListener("click",()=>{
    if(!document.fullscreenElement){
      document.documentElement.requestFullscreen?.().catch(()=>{});
    }else{
      document.exitFullscreen?.().catch(()=>{});
    }
  });
  document.addEventListener("keydown",event=>{
    if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
    if(event.key==="Escape"){index(false);notes(false);return;}
    if(overview.classList.contains("visible"))return;
    if(["ArrowRight","PageDown"," "].includes(event.key)){
      event.preventDefault();show(active+1);
    }else if(["ArrowLeft","PageUp"].includes(event.key)){
      event.preventDefault();show(active-1);
    }else if(event.key==="Home"){event.preventDefault();show(0);}
    else if(event.key==="End"){event.preventDefault();show(count-1);}
    else if(event.key.toLowerCase()==="n"){notes();}
    else if(event.key.toLowerCase()==="m"){index();}
    else if(event.key.toLowerCase()==="f"){
      document.getElementById("fullscreen").click();
    }
  });

  let x0=0,y0=0;
  const deck=document.getElementById("deck");
  deck.addEventListener("touchstart",e=>{
    x0=e.changedTouches[0].screenX;y0=e.changedTouches[0].screenY;
  },{passive:true});
  deck.addEventListener("touchend",e=>{
    const dx=e.changedTouches[0].screenX-x0,dy=e.changedTouches[0].screenY-y0;
    if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.3)show(active+(dx<0?1:-1));
  },{passive:true});

  window.addEventListener("hashchange",()=>{
    const match=location.hash.match(/^#slide-(\d+)$/);
    if(match)show(Number(match[1])-1);
  });
  const match=location.hash.match(/^#slide-(\d+)$/);
  show(match?Number(match[1])-1:0);
})();
