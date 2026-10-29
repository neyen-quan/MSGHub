const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createTimerService}=require('../electron/timer-service.cjs');
function fixture(start=new Date(2026,9,14,9).getTime()){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'msghub-unified-'));let time=start;const filePath=path.join(dir,'work-timer.json');
 let service;return {filePath,dir,now:()=>time,advance:ms=>time+=ms,open(options={}){return service=createTimerService({filePath,now:()=>time,intervalMs:1e8,...options});},close(){service?.shutdown();},cleanup(){service?.shutdown();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('arranca al abrir en trabajo sin comandos, no reinicia por consultar y suma al historial',()=>{
 const f=fixture(),s=f.open();assert.equal(s.getState().phase.kind,'work');f.advance(60000);assert.equal(s.getState().currentDay.workMs,60000);
 s.command('start');assert.equal(s.getState().phase.elapsedMs,60000);s.getState();assert.equal(s.getState().phase.elapsedMs,60000);
 f.close();f.advance(3600000);const r=f.open();assert.equal(r.getState().phase.kind,'work');assert.equal(r.getState().phase.elapsedMs,0);f.advance(60000);assert.equal(r.getState().currentDay.workMs,120000);f.cleanup();
});
test('hasta el límite exacto clasifica Descanso sin formulario y reinicia el ciclo',()=>{
 for(const duration of [1000,299999,300000]){const f=fixture(),s=f.open();f.advance(20*60000);s.command('pause');f.advance(duration);const value=s.command('resume');assert.equal(value.currentDay.pauseMs,duration);assert.equal(value.currentDay.pauseByCategory.Descanso,duration);assert.equal(value.currentDay.workMs,20*60000);assert.equal(value.phase.elapsedMs,0);assert.equal(value.phase.targetMs,55*60000);assert.equal(value.reviewPause,null);f.cleanup();}
});
test('un milisegundo extra exige motivo; el formulario no suma tiempo y Otro exige explicación',()=>{
 const f=fixture(),s=f.open();f.advance(60000);s.command('pause');f.advance(300001);let v=s.command('resume');assert.equal(v.status,'classifying-pause');assert.ok(v.reviewPause);assert.equal(v.phase.startedAt,null);
 assert.throws(()=>s.command('classify-pause',{category:'Otro'}),/Especificá/);f.advance(45000);v=s.command('classify-pause',{category:'Otro',detail:'Trámite'});
 assert.equal(v.currentDay.pauseMs,300001);assert.equal(v.currentDay.workMs,60000);assert.equal(v.currentDay.pauseDetails.Trámite,300001);assert.equal(v.currentDay.leisureMs,0);assert.equal(v.phase.elapsedMs,0);assert.throws(()=>s.command('classify-pause',{category:'GYM'}),/No hay/);f.cleanup();
});
test('cancelar el motivo continúa la misma pausa sin sumar el tiempo del formulario',()=>{
 const f=fixture(),s=f.open();s.command('pause');f.advance(360000);s.command('resume');f.advance(20000);s.command('cancel-pause-review');f.advance(30000);s.command('resume');const v=s.command('classify-pause',{category:'GYM'});assert.equal(v.currentDay.pauseMs,390000);assert.equal(v.currentDay.pauseByCategory.GYM,390000);f.cleanup();
});
test('ciclo y descanso editables; alertas avisan sin cambiar la fase',async()=>{
 const f=fixture(),alarms=[],s=f.open({intervalMs:5,onAlarm:kind=>alarms.push(kind)});s.command('settings',{workMinutes:1,breakMinutes:2});
 // The current block keeps its duration; the next full block uses the edited setting.
 s.command('pause');f.advance(1000);s.command('resume');f.advance(60000);await new Promise(r=>setTimeout(r,20));assert.deepEqual(alarms,['work']);assert.equal(s.getState().phase.kind,'work');
 s.command('pause');f.advance(120000);await new Promise(r=>setTimeout(r,20));assert.deepEqual(alarms,['work','pause']);assert.equal(s.getState().phase.kind,'pause');const v=s.command('resume');assert.equal(v.currentDay.pauseByCategory.Descanso,121000);assert.equal(v.phase.targetMs,60000);f.cleanup();
});
test('la pausa y los totales se actualizan juntos, sin duplicar lo ya asentado',async()=>{
 const f=fixture(),s=f.open({intervalMs:5});f.advance(60000);s.command('pause');let latest;const off=s.subscribe(v=>latest=v);f.advance(2000);await new Promise(r=>setTimeout(r,20));assert.equal(latest.phase.elapsedMs,2000);assert.equal(latest.currentDay.pauseMs,2000);assert.equal(latest.currentDay.workMs+latest.currentDay.pauseMs,62000);s.command('resume');assert.equal(s.getState().currentDay.pauseMs,2000);off();f.cleanup();
});
test('Finalizar por hoy respeta pausas cortas y largas y solo vuelve a iniciar al abrir o pulsar volver',()=>{
 for(const duration of [300000,301000]){const f=fixture(),s=f.open();s.command('pause');f.advance(duration);let v=s.command('finish');if(duration>300000){assert.ok(v.reviewPause);v=s.command('classify-pause',{category:'Descanso'});}assert.equal(v.phase,null);f.advance(60000);assert.equal(s.getState().currentDay.workMs,0);f.close();f.advance(60000);assert.equal(f.open().getState().phase.kind,'work');f.cleanup();}
});
test('migra v1-v4 sumando ocio y pausas por día, categoría y Otro; conserva una copia anterior y no duplica al reabrir',()=>{
 for(const version of [1,2,3,4]){const f=fixture();const input={version,settings:{workMinutes:55,breakMinutes:5},days:{'2026-10-13':{workMs:1000,leisureMs:10000,pauseMs:20000,...(version===1?{}:{leisureByCategory:{Descanso:5000,Otro:5000},pauseByCategory:{GYM:10000,Otro:10000},leisureDetails:{Recado:5000},pauseDetails:{Recado:10000}})}},phase:null};fs.writeFileSync(f.filePath,JSON.stringify(input));let s=f.open();const day=s.getState().days['2026-10-13'];assert.equal(day.workMs,1000);assert.equal(day.pauseMs,30000);assert.equal(day.leisureMs,0);assert.equal(Object.values(day.pauseByCategory).reduce((a,b)=>a+b,0),30000);if(version!==1)assert.equal(day.pauseDetails.Recado,15000);assert.deepEqual(JSON.parse(fs.readFileSync(f.filePath+'.pre-v5.json')),input);f.close();s=f.open();assert.deepEqual(s.getState().days['2026-10-13'],day);f.cleanup();}
});
test('cierre con pausa corta la guarda como Descanso al abrir y excluye el tiempo cerrado',()=>{
 const f=fixture(),s=f.open();f.advance(60000);s.command('pause');f.advance(120000);f.close();f.advance(24*3600000);const r=f.open(),v=r.getState();assert.equal(v.phase.kind,'work');assert.equal(v.days['2026-10-14'].pauseByCategory.Descanso,120000);assert.equal(v.currentDay.pauseMs,0);assert.equal(v.pendingPauses.length,0);f.cleanup();
});
test('una pausa larga pendiente sobrevive al cierre y se clasifica sin interrumpir el trabajo nuevo',()=>{
 const f=fixture(),s=f.open();f.advance(60000);s.command('pause');f.advance(600000);f.close();f.advance(3600000);let r=f.open();assert.equal(r.getState().phase.kind,'work');assert.equal(r.getState().pendingPauses.length,1);f.advance(60000);let v=r.command('classify-pause',{category:'Almorzar'});assert.equal(v.phase.elapsedMs,60000);assert.equal(v.currentDay.workMs,120000);assert.equal(v.currentDay.pauseByCategory.Almorzar,600000);assert.equal(v.pendingPauses.length,0);f.close();r=f.open();assert.equal(r.getState().pendingPauses.length,0);assert.equal(r.getState().currentDay.pauseMs,600000);f.cleanup();
});
test('cancelar revisión histórica permite seguir trabajando y volver a abrir la clasificación',()=>{
 const f=fixture(),s=f.open();s.command('pause');f.advance(600000);f.close();const r=f.open();r.command('cancel-pause-review');assert.equal(r.getState().reviewPause,null);f.advance(5000);assert.equal(r.getState().currentDay.workMs,5000);r.command('review-pause');assert.ok(r.getState().reviewPause);r.command('classify-pause',{category:'GYM'});assert.equal(r.getState().currentDay.workMs,5000);f.cleanup();
});
test('pausa que cruza medianoche distribuye el motivo en cada día',()=>{
 const f=fixture(new Date(2026,9,14,23,58).getTime()),s=f.open();s.command('pause');f.advance(600000);s.command('resume');const v=s.command('classify-pause',{category:'GYM'});assert.equal(v.days['2026-10-14'].pauseByCategory.GYM,120000);assert.equal(v.days['2026-10-15'].pauseByCategory.GYM,480000);f.cleanup();
});
test('recupera un corte hasta savedAt y empieza trabajo nuevo sin contar horas apagadas',()=>{
 const f=fixture();const start=f.now()-120000,savedAt=f.now()-1000;fs.writeFileSync(f.filePath,JSON.stringify({version:4,settings:{workMinutes:55,breakMinutes:5},days:{'2026-10-14':{workMs:1800000,leisureMs:300000,pauseMs:120000}},phase:{kind:'work',elapsedMs:0,startedAt:start,targetMs:3300000,alerted:false},savedAt}));f.advance(5*3600000);const s=f.open(),v=s.getState();assert.equal(v.phase.elapsedMs,0);assert.equal(v.currentDay.workMs,1800000+savedAt-start);assert.equal(v.currentDay.pauseMs,420000);assert.match(v.storageNotice,/PC apagada no se contabilizó/);f.cleanup();
});
test('reemplazo atómico y recuperación desde bak mantienen historia y conservan archivo dañado',()=>{
 const f=fixture(),s=f.open();s.command('adjust-day',{date:'2026-10-13',workMs:7200000,pauseMs:420000});s.command('settings',{workMinutes:50,breakMinutes:7});f.close();assert.equal(JSON.parse(fs.readFileSync(f.filePath+'.bak')).days['2026-10-13'].pauseMs,420000);fs.writeFileSync(f.filePath,'{incompleto');const r=f.open(),v=r.getState();assert.equal(v.days['2026-10-13'].workMs,7200000);assert.equal(v.days['2026-10-13'].pauseMs,420000);assert.match(v.storageNotice,/recuperó/);assert.ok(fs.readdirSync(f.dir).some(n=>n.includes('.corrupt-')));f.cleanup();
});
test('corregir un día redistribuye motivos sin duplicar el antiguo ocio',()=>{
 const f=fixture(),s=f.open();s.command('adjust-day',{date:'2026-10-13',workMs:1000,pauseMs:60000,leisureMs:60000});s.command('adjust-day',{date:'2026-10-13',workMs:3000,pauseMs:240000});const day=s.getState().days['2026-10-13'];assert.equal(day.pauseMs,240000);assert.equal(day.leisureMs,0);assert.equal(Object.values(day.pauseByCategory).reduce((a,b)=>a+b,0),240000);f.cleanup();
});
test('migrar una pausa sobre un ocio previo conserva ambos intervalos pendientes y sus motivos',()=>{
 const f=fixture(),t=f.now();fs.writeFileSync(f.filePath,JSON.stringify({version:4,days:{'2026-10-14':{workMs:1000,leisureMs:360000,pauseMs:60000,leisureByCategory:{'Pendiente de clasificar':360000},pauseByCategory:{'Pendiente de clasificar':60000}}},phase:{kind:'pause',elapsedMs:60000,startedAt:null,segments:[{start:t-60000,end:t}],resumePhase:{kind:'leisure',elapsedMs:360000,startedAt:null,segments:[{start:t-420000,end:t-60000}]}}}));const s=f.open();assert.ok(s.getState().reviewPause);const v=s.command('classify-pause',{category:'Desayunar'});assert.equal(v.currentDay.pauseMs,420000);assert.equal(v.currentDay.pauseByCategory.Desayunar,420000);assert.equal(v.currentDay.pauseByCategory['Pendiente de clasificar'],undefined);f.cleanup();
});
