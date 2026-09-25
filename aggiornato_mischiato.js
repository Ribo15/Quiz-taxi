const STORAGE_KEY = 'quizTaxiMilanoAggiornatoRandom_v1';
let DATA = null;
let qByMaster = new Map();
let state = { answers: {}, order: [], lastMaster: null };
let mode = 'all';

function loadProgress(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.answers) state = parsed;
    }
  }catch(e){}
}

function saveProgress(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function createNewOrder(){
  state.order = shuffle(DATA.questions.map(q => String(q.masterNumber)));
  state.lastMaster = state.order[0] || null;
}

function ensureValidOrder(){
  const valid = new Set(DATA.questions.map(q => String(q.masterNumber)));
  const order = Array.isArray(state.order) ? state.order.map(String) : [];
  const unique = new Set(order);
  const ok = order.length === DATA.questions.length && unique.size === DATA.questions.length && order.every(x => valid.has(x));
  if(!ok) createNewOrder();
}

function showStatus(msg){
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(()=>el.style.display='none',1800);
}

function stats(){
  const vals = Object.values(state.answers || {});
  const correct = vals.filter(x=>x.correct).length;
  return {answered:vals.length, correct, wrong:vals.length-correct};
}

function updateKPI(){
  const s=stats(), total=DATA.questions.length;
  document.getElementById('kAnswered').textContent=`${s.answered}/${total}`;
  document.getElementById('kCorrect').textContent=s.correct;
  document.getElementById('kWrong').textContent=s.wrong;
  document.getElementById('kPct').textContent=s.answered?Math.round(s.correct/s.answered*100)+'%':'0%';
  document.getElementById('progressBar').style.width=(s.answered/total*100)+'%';
}

function orderedQuestions(){
  return state.order.map((masterKey, pos)=>({
    q:qByMaster.get(String(masterKey)),
    masterKey:String(masterKey),
    position:pos+1
  })).filter(x=>x.q);
}

function filteredQuestions(){
  return orderedQuestions().filter(({masterKey})=>{
    if(mode==='errors') return state.answers[masterKey] && !state.answers[masterKey].correct;
    return true;
  });
}

function render(){
  const root=document.getElementById('quiz');
  root.innerHTML='';
  const list=filteredQuestions();

  if(!list.length){
    root.innerHTML='<div class="empty">Nessuna domanda da mostrare in questa vista.</div>';
    updateKPI();
    return;
  }

  list.forEach(({q,masterKey,position})=>{
    const card=document.createElement('section');
    card.className='card';
    card.id='q'+masterKey;

    const meta=document.createElement('div');
    meta.className='meta';
    meta.innerHTML=`<span>Domanda ${position}/${DATA.questions.length}</span><span>Master n. ${q.masterNumber}</span>`;
    card.appendChild(meta);

    const title=document.createElement('div');
    title.className='question';
    title.textContent=q.question;
    card.appendChild(title);

    const correctCount=q.options.filter(o=>o.correct).length;
    if(correctCount!==1){
      const w=document.createElement('div');
      w.className='warning';
      w.textContent=`Nel file questa domanda ha ${correctCount} risposte marcate “ok”.`;
      card.appendChild(w);
    }

    const options=document.createElement('div');
    options.className='options';
    const saved=state.answers[masterKey];

    q.options.forEach((o,oi)=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='option';
      btn.textContent=o.text;

      if(saved){
        if(o.correct) btn.classList.add('correct');
        if(saved.choice===oi && !saved.correct) btn.classList.add('wrong');
      }else{
        btn.addEventListener('click',()=>answer(masterKey,oi,o.correct));
      }
      options.appendChild(btn);
    });
    card.appendChild(options);

    const feedback=document.createElement('div');
    feedback.className='feedback';
    if(saved){
      feedback.textContent=saved.correct
        ? '✓ Corretta secondo la chiave del file'
        : '✗ Errata. La risposta corretta del file è evidenziata in verde.';
      feedback.classList.add(saved.correct?'ok':'ko');
    }
    card.appendChild(feedback);

    const next=document.createElement('button');
    next.type='button';
    next.className='next';
    next.textContent='Prossima domanda →';
    next.addEventListener('click',()=>{
      const idx=state.order.indexOf(masterKey);
      const nextMaster=state.order[(idx+1)%state.order.length];
      state.lastMaster=nextMaster;
      saveProgress();
      const target=document.getElementById('q'+nextMaster);
      if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
    });
    card.appendChild(next);
    root.appendChild(card);
  });

  updateKPI();
}

function answer(masterKey,choice,correct){
  state.answers[masterKey]={choice,correct,at:Date.now()};
  state.lastMaster=masterKey;
  saveProgress();
  render();
  requestAnimationFrame(()=>{
    const el=document.getElementById('q'+masterKey);
    if(el) el.scrollIntoView({block:'center'});
  });
}

function buildReport(){
  const s=stats();
  const lines=[
    'REPORT ERRORI QUIZ TAXI MILANO · ORDINE CASUALE','',
    `Risposte date: ${s.answered}`,
    `Corrette: ${s.correct}`,
    `Errate: ${s.wrong}`,
    `Percentuale corrette: ${s.answered?Math.round(s.correct/s.answered*100):0}%`,
    '','ERRORI:'
  ];

  orderedQuestions().forEach(({q,masterKey,position})=>{
    const a=state.answers[masterKey];
    if(!a || a.correct) return;
    const selected=q.options[a.choice] ? q.options[a.choice].text : '';
    const right=q.options.filter(o=>o.correct).map(o=>o.text).join(' / ');
    lines.push('',
      `Quiz ${position} · Master n. ${q.masterNumber}`,
      `Domanda: ${q.question}`,
      `Hai risposto: ${selected}`,
      `Corretta: ${right}`
    );
  });
  return lines.join('\n');
}

function showReport(){
  document.getElementById('reportText').value=buildReport();
  document.getElementById('reportPanel').style.display='block';
}

async function copyReport(){
  const text=buildReport();
  try{
    await navigator.clipboard.writeText(text);
    showStatus('Errori copiati negli appunti.');
  }catch(e){
    showReport();
    const ta=document.getElementById('reportText');
    ta.focus(); ta.select();
    document.execCommand('copy');
    showStatus('Errori copiati.');
  }
}

document.getElementById('resumeBtn').addEventListener('click',()=>{
  const master=String(state.lastMaster || state.order[0]);
  const el=document.getElementById('q'+master);
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
});

document.getElementById('errorsBtn').addEventListener('click',()=>{
  mode='errors'; render(); showStatus('Mostro solo gli errori.');
});

document.getElementById('allBtn').addEventListener('click',()=>{
  mode='all'; render(); showStatus('Mostro tutte le domande.');
});

document.getElementById('resetBtn').addEventListener('click',()=>{
  if(!confirm('Vuoi azzerare il quiz e generare un nuovo ordine casuale?')) return;
  state={answers:{},order:[],lastMaster:null};
  createNewOrder();
  saveProgress();
  mode='all';
  render();
  showStatus('Quiz azzerato: nuovo ordine generato.');
  window.scrollTo({top:0,behavior:'smooth'});
});

document.getElementById('exportBtn').addEventListener('click',showReport);
document.getElementById('copyBtn').addEventListener('click',copyReport);

window.addEventListener('beforeunload',saveProgress);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveProgress();});

fetch('questions_aggiornato.json?v=2',{cache:'no-store'})
  .then(r=>{if(!r.ok) throw new Error('questions_aggiornato.json non trovato'); return r.json();})
  .then(data=>{
    DATA=data;
    qByMaster=new Map(DATA.questions.map(q=>[String(q.masterNumber),q]));
    loadProgress();
    ensureValidOrder();
    saveProgress();
    render();
    showStatus('Quiz pronto: ordine casuale salvato per questo ciclo.');
  })
  .catch(err=>{
    document.getElementById('quiz').innerHTML=
      '<div class="empty"><b>Errore di caricamento.</b><br>Carica aggiornato_mischiato.html, aggiornato_mischiato.js, questions_aggiornato.json e style.css nella stessa cartella.</div>';
    console.error(err);
  });
