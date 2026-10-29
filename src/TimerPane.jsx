import React, { useEffect, useState } from 'react';
import { AlarmClock, Play, Pause, RotateCcw, Check, Pencil, BellRing, ListChecks } from 'lucide-react';
const fmt = ms => { const s = Math.max(0, Math.floor((ms || 0)/1000)); return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const prettyDate = key => { const [y,m,d]=key.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('es-AR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}); };
const categoryName = name => name === 'Sin categoría (histórico)' ? 'Sin categoría · histórico' : name;
const entries = day => Object.entries(day?.pauseByCategory || {}).filter(([,ms]) => ms > 0).sort((a,b) => b[1]-a[1]);
const alertText = data => data?.phase?.kind === 'work' ? 'Es momento de descansar. Pausá cuando termines la tarea actual.' : 'Terminó el descanso. Volvé al trabajo cuando estés listo.';

export default function TimerPane() {
  const [data,setData]=useState(null), [range,setRange]=useState('day'), [editing,setEditing]=useState(null);
  const [settings,setSettings]=useState({workMinutes:55,breakMinutes:5});
  const [correction,setCorrection]=useState({workMinutes:0,pauseMinutes:0}), [expanded,setExpanded]=useState(''), [error,setError]=useState('');
  useEffect(()=>{window.workhub?.getTimerState?.().then(setData);return window.workhub?.onTimerState?.(setData);},[]);
  useEffect(()=>{if(data)setSettings({workMinutes:data.settings.workMinutes,breakMinutes:data.settings.breakMinutes});},[data?.settings?.workMinutes,data?.settings?.breakMinutes]);
  async function cmd(action,payload){try{setError('');const next=await window.workhub?.timerCommand?.(action,payload);if(next)setData(next);return next;}catch(e){setError(e.message || 'No se pudo guardar.');return null;}}
  if(!data)return <main className="timer-page"><div className="timer-loading">Cargando reloj…</div></main>;
  const phase=data.phase, isPause=phase?.kind==='pause', elapsed=phase?.elapsedMs||0, remaining=(phase?.targetMs||0)-elapsed;
  const work=data.currentDay?.workMs||0, paused=data.currentDay?.pauseMs||0, goal=8*3600000;
  const now=new Date(), todayKey=dateKey(now);
  const rows=Object.entries(data.days||{}).sort(([a],[b])=>b.localeCompare(a)).filter(([key])=>{
    const day=new Date(`${key}T00:00:00`), midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    return range==='day'?key===todayKey:range==='week'?(day<=midnight&&day>=new Date(now.getFullYear(),now.getMonth(),now.getDate()-6)):range==='month'?key.slice(0,7)===todayKey.slice(0,7):key.slice(0,4)===String(now.getFullYear());
  });
  const totals=rows.reduce((t,[,v])=>({work:t.work+(v.workMs||0),pause:t.pause+(v.pauseMs||0)}),{work:0,pause:0});
  const categories=rows.reduce((t,[,day])=>{for(const [name,ms]of entries(day))t[name]=(t[name]||0)+ms;return t;},{});
  function saveSettings(){cmd('settings',{...data.settings,workMinutes:Number(settings.workMinutes)||55,breakMinutes:Number(settings.breakMinutes)||5});}
  function openEdit(key,day){setEditing(key);setCorrection({workMinutes:Math.round(day.workMs/60000),pauseMinutes:Math.round((day.pauseMs||0)/60000)});}
  return <main className="timer-page"><div className="timer-wrap">
    <header className="timer-heading"><div className="timer-heading-icon"><AlarmClock size={22}/></div><div><h1>Reloj de trabajo</h1><p>Empieza al abrir MSGHub. Trabajo y pausas en un único registro diario.</p></div><span className="timer-day-tag">{now.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</span></header>
    {data.storageNotice&&<p className="kanban-notice" role="status">{data.storageNotice}</p>}
    {error&&<p className="kanban-notice" role="alert">{error}</p>}
    {data.pendingPauses?.length>0&&<div className="kanban-notice">Hay {data.pendingPauses.length} pausa(s) anterior(es) sin motivo. El trabajo actual sigue contando. <button onClick={()=>cmd('review-pause')}>Clasificar pausa anterior</button></div>}
    <section className={`timer-main-card ${isPause?'is-break is-paused':''}`}>
      <div className="timer-main-top"><span className="timer-phase-pill"><i className={phase?.startedAt?'pulse':''}/>{!phase?'Jornada finalizada':isPause?(phase.reviewRequested?'Pausa pendiente de motivo':'En pausa · registrando'):'Trabajando'}</span><span className="timer-cycle-caption">{data.settings.workMinutes} min de trabajo · {data.settings.breakMinutes} min de descanso</span></div>
      <div className="timer-digits">{isPause?fmt(elapsed):phase?fmt(Math.abs(remaining)):fmt(data.settings.workMinutes*60000)}</div>
      <div className="timer-caption">{!phase?'hasta la próxima pausa':isPause?'tiempo de esta pausa':remaining<=0?'descanso pendiente':'para tomar un descanso'}</div>
      {phase&&!isPause&&<div className="timer-progress"><i style={{width:`${Math.min(100,elapsed/(phase.targetMs||1)*100)}%`}}/></div>}
      {phase?.alerted&&!phase.reviewRequested&&<div className="timer-due-note"><BellRing size={16}/><span>{alertText(data)}</span></div>}
      <div className="timer-actions">
        {!phase&&<button className="timer-primary" onClick={()=>cmd('start')}><Play size={16}/>Volver a trabajar</button>}
        {phase&&!isPause&&<button className="timer-secondary" onClick={()=>cmd('pause')}><Pause size={16}/>Pausar</button>}
        {isPause&&<button className="timer-primary" onClick={()=>cmd('resume')}><RotateCcw size={16}/>Volver al trabajo</button>}
        {phase&&<button className="timer-text-button" onClick={()=>cmd('finish')}><Check size={15}/>Finalizar por hoy</button>}
      </div>
      <div className="timer-cycle-settings"><span>Duración del ciclo</span><label>Trabajo <input type="number" min="1" max="240" value={settings.workMinutes} onChange={e=>setSettings({...settings,workMinutes:e.target.value})} onBlur={saveSettings}/> min</label><label>Descanso <input type="number" min="1" max="60" value={settings.breakMinutes} onChange={e=>setSettings({...settings,breakMinutes:e.target.value})} onBlur={saveSettings}/> min</label><small>Hasta ese límite: Descanso automático. Si se supera, elegís el motivo al volver.</small></div>
    </section>
    <div className="timer-stats-grid timer-unified-stats">
      <section className="timer-stat-card"><span>Trabajo neto de hoy</span><strong>{fmt(work)}</strong><div className="goal-track"><i style={{width:`${Math.min(100,work/goal*100)}%`}}/></div><small>{work>=goal?'Objetivo diario de 8 horas alcanzado':`${fmt(goal-work)} para completar el objetivo de 8 h`}</small></section>
      <section className="timer-stat-card pause-stat"><span>Pausas de hoy</span><strong>{fmt(paused)}</strong><div className="timer-category-today">{entries(data.currentDay).map(([name,ms])=><div key={name}><span>{categoryName(name)}</span><b>{fmt(ms)}</b></div>)}</div><small>Incluye todo el ocio y las pausas anteriores.</small></section>
      <section className="timer-stat-card recorded-stat"><span>Total registrado de hoy</span><strong>{fmt(work+paused)}</strong><small>Trabajo + pausas.</small></section>
    </div>
    <section className="timer-history-card"><div className="timer-history-head"><div><h2>Historial</h2><p>Trabajo y pausas, con motivos por día y período.</p></div><div className="timer-range-tabs">{[['day','Día'],['week','Semana'],['month','Mes'],['year','Año']].map(([key,label])=><button key={key} className={range===key?'active':''} onClick={()=>setRange(key)}>{label}</button>)}</div></div>
      <div className="timer-range-summary"><div><span>Trabajo</span><b>{fmt(totals.work)}</b></div><div><span>Pausas</span><b>{fmt(totals.pause)}</b></div><div><span>Total registrado</span><b>{fmt(totals.work+totals.pause)}</b></div><div><span>Días registrados</span><b>{rows.length}</b></div></div>
      <div className="timer-range-categories"><strong><ListChecks size={14}/>Desglose de pausas · período seleccionado</strong><div>{Object.entries(categories).sort((a,b)=>b[1]-a[1]).map(([name,ms])=><span className="timer-category-chip" key={name}>{categoryName(name)} <b>{fmt(ms)}</b></span>)}</div></div>
      <div className="timer-table-wrap"><table className="timer-table"><thead><tr><th>Fecha</th><th>Trabajo neto</th><th>Pausas</th><th/></tr></thead><tbody>{rows.length?rows.map(([key,day])=><React.Fragment key={key}><tr><td>{prettyDate(key)}</td><td>{fmt(day.workMs)}</td><td>{fmt(day.pauseMs)}</td><td className="timer-row-actions">{entries(day).length>0&&<button className="timer-edit-button" title="Ver motivos del día" onClick={()=>setExpanded(expanded===key?'':key)}><ListChecks size={14}/></button>}{!(key===data.today&&phase)&&<button className="timer-edit-button" title="Corregir totales del día" onClick={()=>openEdit(key,day)}><Pencil size={14}/></button>}</td></tr>{expanded===key&&<tr className="timer-detail-row"><td colSpan="4"><div>{entries(day).map(([name,ms])=><span key={name}>{categoryName(name)} <b>{fmt(ms)}</b>{name==='Otro'&&Object.entries(day.pauseDetails||{}).map(([detail,time])=><small key={detail}>{detail}: {fmt(time)}</small>)}</span>)}</div></td></tr>}</React.Fragment>):<tr><td colSpan="4" className="timer-empty">Todavía no hay tiempos registrados en este período.</td></tr>}</tbody></table></div>
    </section>
    <div className="timer-cycle-settings"><label><input type="checkbox" checked={data.settings.autoPauseEnabled!==false} onChange={e=>cmd('settings',{...data.settings,autoPauseEnabled:e.target.checked})}/>Pausa automática tras 5 minutos sin mouse ni teclado</label></div>
    <p className="timer-footnote">Al abrir MSGHub empieza un ciclo de trabajo automáticamente. La alerta del ciclo no cambia de fase: vos elegís cuándo pausar. Toda pausa hasta {data.settings.breakMinutes} minutos queda como Descanso; si se supera, elegís un motivo. Cada vuelta al trabajo inicia un ciclo completo. Los primeros 5 minutos de inactividad permanecen como trabajo. {data.monitorStatus?.available?'Detección multimedia de Windows activa.':'Solo se puede verificar el contenido multimedia dentro de MSGHub.'} Podés desactivar la pausa automática al leer o usar contenido que no se detecte. Con MSGHub cerrado no se cuenta tiempo.</p>
  </div>
  {editing&&<div className="timer-edit-backdrop"><form className="timer-edit-dialog" onSubmit={async e=>{e.preventDefault();const next=await cmd('adjust-day',{date:editing,workMs:Number(correction.workMinutes)*60000,pauseMs:Number(correction.pauseMinutes)*60000});if(next)setEditing(null);}}><h3>Corregir totales</h3><p>{prettyDate(editing)}</p><label>Trabajo neto (minutos)<input type="number" min="0" value={correction.workMinutes} onChange={e=>setCorrection({...correction,workMinutes:e.target.value})}/></label><label>Pausas (minutos)<input type="number" min="0" value={correction.pauseMinutes} onChange={e=>setCorrection({...correction,pauseMinutes:e.target.value})}/></label><small>El desglose de motivos se recalcula proporcionalmente.</small><div><button type="button" onClick={()=>setEditing(null)}>Cancelar</button><button type="submit">Guardar</button></div></form></div>}
  </main>;
}
export function TimerAlarmOverlay({visible=true}){
  const [data,setData]=useState(null), [dismissed,setDismissed]=useState(false);
  useEffect(()=>{window.workhub?.getTimerState?.().then(setData);return window.workhub?.onTimerState?.(setData);},[]);
  useEffect(()=>setDismissed(false),[data?.phase?.alerted,data?.phase?.kind]);
  if(!visible||dismissed||!data?.phase?.alerted||data.phase.reviewRequested)return null;
  const working=data.phase.kind==='work';
  return <div className="timer-global-alert"><BellRing size={17}/><span>{alertText(data)}</span><button onClick={()=>window.workhub.timerCommand(working?'pause':'resume').then(setData)}>{working?'Pausar':'Volver al trabajo'}</button><button className="timer-alert-dismiss" aria-label="Cerrar aviso" onClick={()=>setDismissed(true)}>×</button></div>;
}
