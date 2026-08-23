
const STORAGE_KEY = 'quizTaxiMilanoProgress_v1';
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
  }catch(e){
    console.warn('Impossibile leggere il salvataggio', e);
  }
}

function saveProgress(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showStatus(msg){
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(()=> el.style.display='none', 1800);
}

function stats(){
  const vals = Object.values(state.answers);
  const correct = vals.filter(x=>x.correct).length;
  return { answered: vals.length, correct, wrong: vals.length-correct };
}

function updateKPI(){
  const s = stats();
  const total = DATA.questions.length;
  document.getElementById('kAnswered').textContent = `${s.answered}/${total}`;
  document.getElementById('kCorrect').textContent = s.correct;
  document.getElementById('kWrong').textContent = s.wrong;
  document.getElementById('kPct').textContent = s.answered ? Math.round(s.correct/s.answered*100)+'%' : '0%';
  document.getElementById('progressBar').style.width = (s.answered/total*100)+'%';
}

function filteredQuestions(){
  return DATA.questions
    .map((q,i)=>({q,index:i+1}))
    .filter(({index})=>{
      if(mode==='errors') return state.answers[index] && !state.answers[index].correct;
      return true;
    });
}

function render(){
  const root = document.getElementById('quiz');
  root.innerHTML = '';
  const list = filteredQuestions();

  if(!list.length){
    root.innerHTML = '<div class="empty">Nessuna domanda da mostrare in questa vista.</div>';
    updateKPI();
    return;
  }

  list.forEach(({q,index})=>{
    const card = document.createElement('section');
    card.className='card';
    card.id='q'+index;

    const meta = document.createElement('div');
    meta.className='meta';
    meta.innerHTML = `<span>Domanda ${index}/${DATA.questions.length}</span><span>Master n. ${q.masterNumber}</span>`;
    card.appendChild(meta);

    const title = document.createElement('div');
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
      btn.type='button';
      btn.className='option';
      btn.textContent=o.text;

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
      const nextIndex = index < DATA.questions.length ? index+1 : 1;
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
  const idx=state.lastQuestion || 1;
  const el=document.getElementById('q'+idx);
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
});

document.getElementById('errorsBtn').addEventListener('click',()=>{
  mode='errors';
  render();
  showStatus('Mostro solo gli errori salvati.');
});

document.getElementById('allBtn').addEventListener('click',()=>{
  mode='all';
  render();
  showStatus('Mostro tutte le domande.');
});

document.getElementById('resetBtn').addEventListener('click',()=>{
  if(!confirm('Vuoi cancellare tutte le risposte e ripartire da zero?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state={answers:{},lastQuestion:1};
  mode='all';
  render();
  showStatus('Quiz azzerato.');
  window.scrollTo({top:0,behavior:'smooth'});
});

window.addEventListener('beforeunload',saveProgress);
document.addEventListener('visibilitychange',()=>{if(document.hidden) saveProgress();});


function buildErrorReport(){
  if(!DATA) return null;

  const errorEntries = Object.keys(state.answers)
    .map(Number)
    .sort((a,b)=>a-b)
    .filter(index => state.answers[index] && !state.answers[index].correct)
    .map(index => {
      const q = DATA.questions[index-1];
      const saved = state.answers[index];
      if(!q || !saved) return null;

      const selected = q.options[saved.choice] ? q.options[saved.choice].text : '';
      const correctAnswers = q.options.filter(o=>o.correct).map(o=>o.text);

      return {
        numeroQuiz: index,
        numeroMaster: q.masterNumber,
        domanda: q.question,
        rispostaData: selected,
        rispostaCorretta: correctAnswers.join(' / ')
      };
    })
    .filter(Boolean);

  const s = stats();

  return {
    titolo: 'Report errori Quiz Taxi Milano',
    generatoIl: new Date().toISOString(),
    riepilogo: {
      risposteDate: s.answered,
      corrette: s.correct,
      errate: s.wrong,
      percentualeCorrette: s.answered ? Math.round(s.correct/s.answered*100) : 0
    },
    errori: errorEntries
  };
}

function reportAsText(report){
  const r = report.riepilogo;
  const lines = [
    'REPORT ERRORI QUIZ TAXI MILANO',
    '',
    `Risposte date: ${r.risposteDate}`,
    `Corrette: ${r.corrette}`,
    `Errate: ${r.errate}`,
    `Percentuale corrette: ${r.percentualeCorrette}%`,
    '',
    'ERRORI:'
  ];

  if(!report.errori.length){
    lines.push('Nessun errore salvato.');
  }else{
    report.errori.forEach((e,i)=>{
      lines.push(
        '',
        `${i+1}. Quiz ${e.numeroQuiz} · Master n. ${e.numeroMaster}`,
        `Domanda: ${e.domanda}`,
        `Hai risposto: ${e.rispostaData}`,
        `Corretta: ${e.rispostaCorretta}`
      );
    });
  }
  return lines.join('\n');
}

async function exportErrors(){
  const report = buildErrorReport();
  if(!report) return;

  if(!report.errori.length){
    showStatus('Non ci sono errori da esportare.');
    return;
  }

  const text = reportAsText(report);
  const filename = `errori_quiz_taxi_${new Date().toISOString().slice(0,10)}.txt`;
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const file = new File([blob], filename, {type:'text/plain'});

  // Su iPhone/Safari prova prima il pannello Condividi.
  try{
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({
        files:[file],
        title:'Errori Quiz Taxi',
        text:'Report degli errori salvati nel Quiz Taxi Milano'
      });
      showStatus('Report errori condiviso.');
      return;
    }
  }catch(e){
    if(e && e.name === 'AbortError') return;
  }

  // Fallback universale: download del file.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showStatus('Report errori scaricato.');
}

async function copyErrors(){
  const report = buildErrorReport();
  if(!report) return;
  const text = reportAsText(report);

  try{
    await navigator.clipboard.writeText(text);
    showStatus(report.errori.length ? 'Errori copiati negli appunti.' : 'Riepilogo copiato.');
  }catch(e){
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position='fixed';
    ta.style.opacity='0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showStatus('Errori copiati negli appunti.');
  }
}

document.getElementById('exportBtn').addEventListener('click', exportErrors);
document.getElementById('copyBtn').addEventListener('click', copyErrors);


fetch('questions.json', {cache:'no-store'})
  .then(r=>{
    if(!r.ok) throw new Error('questions.json non trovato');
    return r.json();
  })
  .then(data=>{
    DATA=data;
    loadProgress();
    render();
    showStatus('Quiz pronto. Salvataggio automatico attivo.');
  })
  .catch(err=>{
    document.getElementById('quiz').innerHTML =
      '<div class="empty"><b>Errore di caricamento.</b><br>Pubblica tutti e 4 i file nella stessa cartella su GitHub Pages.</div>';
    console.error(err);
  });
