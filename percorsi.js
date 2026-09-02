
const STORAGE_KEY = 'quizTaxiPercorsi_v1';
let DATA = null;
let state = {
  routes: {},
  currentRouteId: null,
  category: 'Tutte',
  onlyErrors: false,
  mode: 'sequence'
};

const $ = id => document.getElementById(id);

function freshRouteState(){
  return {pos:0, wrong:0, correct:0, completed:false, assisted:false, updatedAt:Date.now()};
}
function rs(id){
  if(!state.routes[id]) state.routes[id]=freshRouteState();
  return state.routes[id];
}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed=JSON.parse(raw);
      if(parsed && parsed.routes) state={...state,...parsed};
    }
  }catch(e){}
}
function saveState(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}
function shuffle(arr){
  arr=[...arr];
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function allCategories(){
  return ['Tutte',...Array.from(new Set(DATA.routes.map(r=>r.category))).sort((a,b)=>a.localeCompare(b,'it'))];
}
function filteredRoutes(){
  let list=DATA.routes.filter(r=>state.category==='Tutte' || r.category===state.category);
  if(state.onlyErrors){
    list=list.filter(r=>{
      const s=state.routes[r.id];
      return s && (s.wrong>0 || s.assisted);
    });
  }
  return list;
}
function currentRoute(){
  const list=filteredRoutes();
  if(!list.length) return null;
  let r=list.find(x=>x.id===state.currentRouteId);
  if(!r){
    r=list[0];
    state.currentRouteId=r.id;
    saveState();
  }
  return r;
}
function stats(){
  let completed=0, perfect=0, wrong=0, correct=0;
  DATA.routes.forEach(r=>{
    const s=state.routes[r.id];
    if(!s) return;
    if(s.completed) completed++;
    if(s.completed && s.wrong===0 && !s.assisted) perfect++;
    wrong+=s.wrong||0;
    correct+=s.correct||0;
  });
  return {completed,perfect,wrong,correct};
}
function updateKPI(){
  const s=stats();
  $('kCompleted').textContent=`${s.completed}/${DATA.routes.length}`;
  $('kPerfect').textContent=s.perfect;
  $('kWrong').textContent=s.wrong;
  const total=s.correct+s.wrong;
  $('kPct').textContent=total?Math.round(s.correct/total*100)+'%':'0%';
  $('progressBar').style.width=(s.completed/DATA.routes.length*100)+'%';
}
function buildSelectors(){
  const cats=allCategories();
  $('categorySelect').innerHTML=cats.map(c=>`<option value="${esc(c)}"${c===state.category?' selected':''}>${esc(c)}</option>`).join('');
  const list=filteredRoutes();
  $('routeSelect').innerHTML=list.map((r,i)=>`<option value="${r.id}"${r.id===state.currentRouteId?' selected':''}>${i+1}. ${esc(r.title)}</option>`).join('');
}
function esc(v){
  return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function routeIndex(r){
  const list=filteredRoutes();
  return list.findIndex(x=>x.id===r.id);
}
function feedback(msg,type){
  const el=$('feedback');
  if(!el) return;
  el.textContent=msg;
  el.className='feedback '+type;
}
function chooseStep(r, label, btn){
  const s=rs(r.id);
  if(s.completed) return;
  const expected=r.steps[s.pos];

  if(label===expected){
    s.pos++;
    s.correct++;
    s.updatedAt=Date.now();
    if(s.pos>=r.steps.length){
      s.completed=true;
    }
    saveState();
    if(btn){
      btn.classList.add('correctflash');
      setTimeout(render,120);
    }else render();
  }else{
    s.wrong++;
    s.updatedAt=Date.now();
    saveState();
    if(btn){
      btn.classList.add('wrongflash');
      feedback(`No: la prossima tappa non è “${label}”. Riprova.`, 'ko');
      setTimeout(()=>btn.classList.remove('wrongflash'),650);
    }
    updateKPI();
  }
}
function candidateChoices(r,s){
  const expected=r.steps[s.pos];
  const later=r.steps.slice(s.pos+1);
  let pool=Array.from(new Set(later.filter(x=>x!==expected)));
  if(pool.length<3){
    const global=DATA.routes.flatMap(x=>x.steps);
    pool=pool.concat(global.filter(x=>x!==expected && !pool.includes(x)));
  }
  return shuffle([expected,...shuffle(pool).slice(0,3)]);
}
function renderBuilt(r,s){
  if(s.pos===0) return `<div class="built empty">La sequenza corretta che costruisci comparirà qui.</div>`;
  return `<div class="built">${r.steps.slice(0,s.pos).map((x,i)=>`<div class="built-step"><span class="num">${i+1}</span><span>${esc(x)}</span></div>`).join('')}</div>`;
}
function render(){
  updateKPI();
  buildSelectors();
  $('sequenceMode').classList.toggle('active',state.mode==='sequence');
  $('nextMode').classList.toggle('active',state.mode==='next');
  $('errorsBtn').classList.toggle('active',state.onlyErrors);
  $('errorsBtn').textContent=state.onlyErrors?'Tutte':'Solo errori';

  const r=currentRoute();
  const root=$('quiz');
  if(!r){
    root.innerHTML=`<div class="empty">Non ci sono percorsi in questa vista. Disattiva “Solo errori” oppure cambia categoria.</div>`;
    buildSelectors();
    return;
  }
  const s=rs(r.id);
  const idx=routeIndex(r);
  const total=filteredRoutes().length;
  const remaining=r.steps.slice(s.pos);

  let interaction='';
  if(s.completed){
    interaction=`<div class="complete ${s.wrong||s.assisted?'with-errors':''}">
      ${s.wrong===0 && !s.assisted ? '✓ Percorso completato senza errori.' : `✓ Percorso completato. Errori: ${s.wrong}${s.assisted?' · soluzione consultata':''}.`}
    </div>`;
  } else if(state.mode==='sequence'){
    const items=shuffle(remaining.map((text,i)=>({text,key:i+'_'+text})));
    interaction=`<div class="pool-title">Tocca le tappe nell’ordine corretto:</div>
      <div class="pool">${items.map(it=>`<button class="stepbtn" data-label="${encodeURIComponent(it.text)}">${esc(it.text)}</button>`).join('')}</div>`;
  } else {
    const choices=candidateChoices(r,s);
    interaction=`<div class="pool-title">Qual è la prossima tappa?</div>
      <div class="pool">${choices.map(text=>`<button class="stepbtn" data-label="${encodeURIComponent(text)}">${esc(text)}</button>`).join('')}</div>`;
  }

  const notes=(r.sourceNotes&&r.sourceNotes.length)
    ? `<details class="notes"><summary>Note della fonte</summary>${r.sourceNotes.map(n=>`<div>${esc(n)}</div>`).join('')}</details>`:'';

  root.innerHTML=`
    <article class="card">
      <div class="meta">
        <span class="chip">Percorso ${idx+1}/${total}</span>
        <span class="chip">${esc(r.category)}</span>
        <span class="chip">Pagina ${r.sourcePage}</span>
        ${r.derivedFrom?'<span class="chip">Mini-tratta derivata</span>':''}
      </div>
      <div class="route-title">${esc(r.title)}</div>
      <div class="step-progress">Tappe corrette: ${s.pos}/${r.steps.length}</div>
      ${renderBuilt(r,s)}
      ${interaction}
      <div id="feedback" class="feedback"></div>

      <div class="actions">
        <button id="restartRouteBtn">Ricomincia percorso</button>
        <button id="solutionBtn" class="hint">${s.assisted?'Nascondi soluzione':'Mostra soluzione'}</button>
      </div>
      <div id="solutionBox" class="solution ${s.assisted?'show':''}">
        <b>Sequenza della fonte</b>
        <ol>${r.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
      </div>
      ${notes}
      <div class="footer-nav">
        <button id="prevBtn">← Precedente</button>
        <button id="reportBtn">Report errori</button>
        <button id="nextBtn">Successivo →</button>
      </div>
    </article>`;

  root.querySelectorAll('.stepbtn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const label=decodeURIComponent(btn.dataset.label);
      chooseStep(r,label,btn);
    });
  });

  $('restartRouteBtn').addEventListener('click',()=>{
    if(confirm('Ricominciare questo percorso da zero?')){
      state.routes[r.id]=freshRouteState();
      saveState(); render();
    }
  });
  $('solutionBtn').addEventListener('click',()=>{
    const rr=rs(r.id);
    rr.assisted=!rr.assisted;
    rr.updatedAt=Date.now();
    saveState(); render();
  });
  $('prevBtn').addEventListener('click',()=>move(-1));
  $('nextBtn').addEventListener('click',()=>move(1));
  $('reportBtn').addEventListener('click',showReport);
}
function move(delta){
  const list=filteredRoutes();
  if(!list.length) return;
  const r=currentRoute();
  let i=list.findIndex(x=>x.id===r.id);
  i=(i+delta+list.length)%list.length;
  state.currentRouteId=list[i].id;
  saveState(); render();
  window.scrollTo({top:0,behavior:'smooth'});
}
function showReport(){
  const bad=DATA.routes.filter(r=>{
    const s=state.routes[r.id];
    return s && (s.wrong>0 || s.assisted);
  });
  const lines=[
    'REPORT TRAINING PERCORSI TAXI MILANO','',
    `Percorsi totali: ${DATA.routes.length}`,
    `Percorsi con errori/aiuto: ${bad.length}`,''
  ];
  bad.forEach((r,i)=>{
    const s=state.routes[r.id];
    lines.push(`${i+1}. ${r.title}`,`Pagina fonte: ${r.sourcePage}`,`Errori: ${s.wrong||0}${s.assisted?' · soluzione consultata':''}`,`Progresso: ${s.pos}/${r.steps.length}`,'');
  });
  $('reportText').value=lines.join('\n');
  $('reportPanel').classList.add('show');
  $('reportPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function resetAll(){
  if(!confirm('Vuoi azzerare tutto il training percorsi? Il Master e gli altri training non verranno toccati.')) return;
  localStorage.removeItem(STORAGE_KEY);
  state={routes:{},currentRouteId:DATA.routes[0]?.id||null,category:'Tutte',onlyErrors:false,mode:'sequence'};
  saveState(); render();
}
$('categorySelect').addEventListener('change',e=>{
  state.category=e.target.value;
  state.currentRouteId=null;
  saveState(); render();
});
$('routeSelect').addEventListener('change',e=>{
  state.currentRouteId=e.target.value;
  saveState(); render();
});
$('sequenceMode').addEventListener('click',()=>{state.mode='sequence';saveState();render();});
$('nextMode').addEventListener('click',()=>{state.mode='next';saveState();render();});
$('errorsBtn').addEventListener('click',()=>{
  state.onlyErrors=!state.onlyErrors; state.currentRouteId=null; saveState(); render();
});
$('randomBtn').addEventListener('click',()=>{
  const list=filteredRoutes();
  if(!list.length) return;
  state.currentRouteId=list[Math.floor(Math.random()*list.length)].id;
  saveState(); render();
});
$('resumeBtn').addEventListener('click',()=>{
  render();
  $('quiz').scrollIntoView({behavior:'smooth',block:'start'});
});
$('resetBtn').addEventListener('click',resetAll);
$('closeReportBtn').addEventListener('click',()=>$('reportPanel').classList.remove('show'));
$('selectReportBtn').addEventListener('click',()=>{
  const ta=$('reportText'); ta.focus(); ta.select();
});

window.addEventListener('beforeunload',saveState);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveState();});

fetch('percorsi.json?v=1',{cache:'no-store'})
  .then(r=>{if(!r.ok) throw new Error('Impossibile caricare percorsi.json'); return r.json();})
  .then(data=>{
    DATA=data;
    loadState();
    if(!state.currentRouteId || !DATA.routes.some(r=>r.id===state.currentRouteId)){
      state.currentRouteId=DATA.routes[0]?.id||null;
    }
    saveState();
    render();
  })
  .catch(err=>{
    $('quiz').innerHTML=`<div class="empty">Errore nel caricamento dei percorsi: ${esc(err.message)}</div>`;
    console.error(err);
  });
