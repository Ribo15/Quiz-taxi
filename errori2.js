
const STORAGE_KEY = 'quizTaxiMilanoErroriCiclo2_v1';
let DATA = null;
let state = { answers: {}, lastQuestion: 1 };
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
function saveProgress(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function showStatus(msg){
  const el=document.getElementById('status');
  el.textContent=msg; el.style.display='block';
  clearTimeout(showStatus.timer);
  showStatus.timer=setTimeout(()=>el.style.display='none',1800);
}
function stats(){
  const vals=Object.values(state.answers);
  const correct=vals.filter(x=>x.correct).length;
  return {answered:vals.length,correct,wrong:vals.length-correct};
}
function updateKPI(){
  const s=stats(), total=DATA.questions.length;
  document.getElementById('kAnswered').textContent=`${s.answered}/${total}`;
  document.getElementById('kCorrect').textContent=s.correct;
  document.getElementById('kWrong').textContent=s.wrong;
  document.getElementById('kPct').textContent=s.answered?Math.round(s.correct/s.answered*100)+'%':'0%';
  document.getElementById('progressBar').style.width=(s.answered/total*100)+'%';
}
function filteredQuestions(){
  return DATA.questions.map((q,i)=>({q,index:i+1})).filter(({index})=>{
    if(mode==='errors') return state.answers[index] && !state.answers[index].correct;
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

  list.forEach(({q,index})=>{
    const card=document.createElement('section');
    card.className='card'; card.id='q'+index;

    const meta=document.createElement('div');
    meta.className='meta';
    meta.innerHTML=`<span>Training ${index}/${DATA.questions.length}</span><span>Quiz originale ${q.originalQuizNumber}</span><span>Master n. ${q.masterNumber}</span>`;
    card.appendChild(meta);

    const title=document.createElement('div');
    title.className='question';
    title.textContent=q.question;
    card.appendChild(title);

    const correctCount=q.options.filter(o=>o.correct).length;
    if(correctCount!==1){
      const w=document.createElement('div');
      w.className='warning';
      w.textContent=`Nel Master questa domanda ha ${correctCount} risposte marcate “ok”.`;
      card.appendChild(w);
    }

    const options=document.createElement('div');
    options.className='options';
    const saved=state.answers[index];

    q.options.forEach((o,oi)=>{
      const btn=document.createElement('button');
      btn.type='button'; btn.className='option'; btn.textContent=o.text;
      if(saved){
        if(o.correct) btn.classList.add('correct');
        if(saved.choice===oi && !saved.correct) btn.classList.add('wrong');
      }else{
        btn.addEventListener('click',()=>answer(index,oi,o.correct));
      }
      options.appendChild(btn);
    });

    card.appendChild(options);

    const feedback=document.createElement('div');
    feedback.className='feedback';
    if(saved){
      feedback.textContent=saved.correct
        ? '✓ Corretta secondo la chiave del Master'
        : '✗ Errata. La risposta corretta del Master è evidenziata in verde.';
      feedback.classList.add(saved.correct?'ok':'ko');
    }
    card.appendChild(feedback);

    const next=document.createElement('button');
    next.type='button';
    next.className='next';
    next.textContent='Prossima domanda →';
    next.addEventListener('click',()=>{
      const nextIndex=index<DATA.questions.length?index+1:1;
      state.lastQuestion=nextIndex;
      saveProgress();
      const target=document.getElementById('q'+nextIndex);
      if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
    });
    card.appendChild(next);

    root.appendChild(card);
  });

  updateKPI();
}

function answer(index,choice,correct){
  state.answers[index]={choice,correct,at:Date.now()};
  state.lastQuestion=index;
  saveProgress();
  render();
  requestAnimationFrame(()=>{
    const el=document.getElementById('q'+index);
    if(el) el.scrollIntoView({block:'center'});
  });
}

document.getElementById('resumeBtn').addEventListener('click',()=>{
  const el=document.getElementById('q'+(state.lastQuestion||1));
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
});

document.getElementById('errorsBtn').addEventListener('click',()=>{
  mode=mode==='errors'?'all':'errors';
  document.getElementById('errorsBtn').textContent=mode==='errors'?'Tutte':'Solo errori';
  render();
});

document.getElementById('resetBtn').addEventListener('click',()=>{
  if(!confirm('Vuoi azzerare solo il training dei 42 errori del ciclo 2?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state={answers:{},lastQuestion:1};
  mode='all';
  render();
  showStatus('Training ciclo 2 azzerato. Il Master completo non è stato toccato.');
  window.scrollTo({top:0,behavior:'smooth'});
});

window.addEventListener('beforeunload',saveProgress);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveProgress();});

fetch('errori2.json?v=1',{cache:'no-store'})
  .then(r=>r.json())
  .then(data=>{
    DATA=data;
    loadProgress();
    render();
    showStatus('Training ciclo 2 pronto.');
  })
  .catch(err=>{
    document.getElementById('quiz').innerHTML='<div class="empty">Errore di caricamento del training.</div>';
    console.error(err);
  });
