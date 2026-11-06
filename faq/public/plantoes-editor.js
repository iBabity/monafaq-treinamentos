(() => {
  const local = location.hostname === '127.0.0.1' && location.port === '3081';
  const daysEl = document.getElementById('days'), note = document.getElementById('source-note');
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const current = new Date();
  let year = current.getFullYear() === 2027 ? 2027 : 2026;
  let month = [2026,2027].includes(current.getFullYear()) ? current.getMonth() : 0;
  let months = [], base2026 = [], base2027 = [], edits = {}, isMaster = false, busy = false, sourceMessage = '';
  const dateKey = day => `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const holidays2027={'01-01':'Confraternização Universal','02-08':'Carnaval (ponto facultativo, sujeito a confirmação)','02-09':'Carnaval (ponto facultativo, sujeito a confirmação)','02-10':'Quarta-feira de Cinzas (ponto facultativo, sujeito a confirmação)','03-26':'Sexta-feira da Paixão (conforme legislação local)','04-21':'Tiradentes','05-01':'Dia do Trabalho','05-27':'Corpus Christi (ponto facultativo, sujeito a confirmação)','09-07':'Independência do Brasil','10-12':'Nossa Senhora Aparecida','11-02':'Finados','11-15':'Proclamação da República','11-20':'Dia Nacional de Zumbi e da Consciência Negra','12-25':'Natal'};
  function blank2027(){return names.map((name,i)=>({title:`${name} 2027`,days:Array.from({length:new Date(2027,i+1,0).getDate()},(_,j)=>{const day=j+1,key=`${String(i+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return {day,name:'',holiday:holidays2027[key]||''}})}))}
  function render(){
    const m=months[month]; if(!m)return;
    document.getElementById('title').textContent=m.title;
    document.getElementById('months').innerHTML=months.map((x,i)=>`<button type="button" data-month="${i}" aria-current="${i===month}">${escapeHtml(x.title.replace(/ 202[67]$/, ''))}</button>`).join('');
    const offset=(new Date(year,month,1).getDay()+6)%7;
    daysEl.innerHTML='<div class="day empty" aria-hidden="true"></div>'.repeat(offset)+m.days.map(d=>{
      const key=dateKey(d.day), edited=Object.prototype.hasOwnProperty.call(edits,key), name=edited?edits[key]:d.name;
      const detail=edited ? (name?`<span class="person">${escapeHtml(name)}</span>`:'<span class="unassigned">Sem responsável</span>') : d.invalid?'<span class="unassigned">Data divergente na planilha</span>':name?`<span class="person">${escapeHtml(name)}</span>`:'<span class="unassigned">Não informado</span>';
      return `<div class="day"><span class="date">${d.day}</span>${detail}${d.holiday?`<span class="holiday">${escapeHtml(d.holiday)}</span>`:''}${edited?'<span class="edit-mark">Editado no FAQ</span>':''}${isMaster?`<button class="edit-day" type="button" data-edit-day="${d.day}" aria-label="Editar plantão de ${d.day} de ${escapeHtml(m.title)}">Editar</button>`:''}</div>`;
    }).join('');
    document.getElementById('prev').disabled=month===0;document.getElementById('next').disabled=month===11;
  }
  async function load(){
    if(busy)return;busy=true;
    try{
      let base,warning='',canConnect=false;
      const snapshotResponse=await fetch('/plantoes-2026-2027.json',{cache:'no-store'});
      if(!snapshotResponse.ok)throw Error('Cópia da nova escala indisponível.');
      const snapshot=await snapshotResponse.json();
      let newer={december2026:snapshot.months2026['11'],months2027:snapshot.months2027};
      let newWarning='Exibindo cópia da nova escala de 05/11/2026; confirme alterações na planilha.';
      if(local){
        let r=await fetch('/api/plantoes/atual',{cache:'no-store'}), payload=await r.json();
        if(r.ok){base=payload.months;warning='Escala de janeiro a novembro de 2026 atualizada pelo Google Drive em '+new Date(payload.updatedAt).toLocaleString('pt-BR')+'. '+(payload.warnings.length?'Datas para revisar na planilha: '+payload.warnings.join(' '):'');if(payload.newSchedule){newer=payload.newSchedule;newWarning='Nova escala atualizada pelo Google Drive em '+new Date(payload.updatedAt).toLocaleString('pt-BR')+'.'}else if(payload.newScheduleError){newWarning=payload.newScheduleError+' '+newWarning}}
        else {let old=await fetch('/plantoes-2026.json');if(!old.ok)throw Error();base=await old.json();warning=(payload.error||'Não foi possível atualizar a escala.')+' Exibindo cópia de 03/11/2026; confirme na planilha original.';canConnect=payload.master===true;}
        const er=await fetch('/api/plantoes/edicao',{cache:'no-store'});if(!er.ok)throw Error('edicoes');const e=await er.json();const next={};for(const row of e.edicoes)next[row.data]=row.responsavel;edits=next;
      }else {const r=await fetch('/plantoes-2026.json');if(!r.ok)throw Error();base=await r.json()}
      base2026=base.slice();base2026[11]=newer.december2026;base2027=newer.months2027;months=year===2026?base2026:base2027;sourceMessage=(year===2026?warning+' ':'')+newWarning+' As edições feitas no FAQ têm prioridade sobre a planilha. A escala é uma proposta; confira trocas e distribuição.';note.textContent=sourceMessage;if(local&&canConnect){const f=document.createElement('form'),b=document.createElement('button');f.method='post';f.action='/google-drive/conectar';b.type='submit';b.textContent='Conectar Google Drive';f.append(b);note.append(f)}render();
    }catch{note.textContent='Não foi possível carregar ou atualizar os plantões. Consulte a planilha original.';if(!months.length)daysEl.textContent='Não foi possível carregar a escala.'}
    finally{busy=false}
  }
  document.getElementById('months').onclick=e=>{const b=e.target.closest('[data-month]');if(b){month=Number(b.dataset.month);render()}};
  document.getElementById('prev').onclick=()=>{if(month>0){month--;render()}};
  document.getElementById('next').onclick=()=>{if(month<11){month++;render()}};
  document.getElementById('shift-year').onchange=e=>{year=Number(e.target.value);months=year===2026?base2026:base2027;document.getElementById('shift-reset').textContent='Usar planilha';load();render()};
  daysEl.onclick=e=>{const b=e.target.closest('[data-edit-day]');if(!b||!isMaster)return;const day=Number(b.dataset.editDay),entry=months[month].days.find(d=>d.day===day),key=dateKey(day),dialog=document.getElementById('shift-dialog');document.getElementById('shift-date').value=key;document.getElementById('shift-label').textContent=`Plantão de ${String(day).padStart(2,'0')}/${String(month+1).padStart(2,'0')}/${year}`;document.getElementById('shift-reset').textContent='Usar planilha';document.getElementById('shift-name').value=Object.prototype.hasOwnProperty.call(edits,key)?edits[key]:entry.invalid?'':entry.name||'';document.getElementById('shift-status').textContent='';dialog.showModal();document.getElementById('shift-name').focus()};
  document.getElementById('shift-cancel').onclick=()=>document.getElementById('shift-dialog').close();
  document.getElementById('shift-reset').onclick=async()=>{const key=document.getElementById('shift-date').value,status=document.getElementById('shift-status'),button=document.getElementById('shift-reset');button.disabled=true;status.textContent='Restaurando…';try{const r=await fetch('/api/plantoes/edicao',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:key})});if(!r.ok)throw Error();delete edits[key];document.getElementById('shift-dialog').close();render()}catch{status.textContent='Não foi possível restaurar o valor da planilha.'}finally{button.disabled=false}};
  document.getElementById('shift-form').onsubmit=async e=>{e.preventDefault();let form=e.currentTarget,button=form.querySelector('[type=submit]'),status=document.getElementById('shift-status');button.disabled=true;status.textContent='Salvando…';try{const r=await fetch('/api/plantoes/edicao',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:document.getElementById('shift-date').value,responsavel:document.getElementById('shift-name').value})});const result=await r.json();if(!r.ok)throw Error(result.error||'Não foi possível salvar.');edits[result.data]=result.responsavel;document.getElementById('shift-dialog').close();render()}catch(err){status.textContent=err.message||'Não foi possível salvar.'}finally{button.disabled=false}};
  document.getElementById('shift-year').value=String(year);
  if(local){fetch('/api/plantoes/permissao',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(p=>{isMaster=p.master===true;render()}).catch(()=>{});setInterval(()=>{if(!document.hidden)load()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()})}
  load();
})();
