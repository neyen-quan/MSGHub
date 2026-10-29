const test=require('node:test'),assert=require('node:assert/strict');
const {createIdlePolicy}=require('../electron/activity-monitor.cjs');
const {createTimerService}=require('../electron/timer-service.cjs');
function fixture(){let time=new Date(2026,9,14,9).getTime();const now=()=>time;const service=createTimerService({now,intervalMs:1e8}),policy=createIdlePolicy({now});return {service,policy,advance:ms=>time+=ms,sample:(idleSeconds,mediaPlaying=false)=>policy({state:service.getState(),idleSeconds,mediaPlaying})};}
test('cinco minutos sin teclado ni mouse activan pausa; multimedia y período posterior la evitan',()=>{
 const f=fixture();f.advance(299000);assert.equal(f.sample(299),null);f.advance(1000);assert.equal(f.sample(300),'auto-pause');assert.equal(f.sample(0),null);assert.equal(f.sample(500,true),null);f.advance(299000);assert.equal(f.sample(799),null);f.advance(1000);assert.equal(f.sample(800),'auto-pause');f.service.command('settings',{autoPauseEnabled:false});assert.equal(f.sample(900),null);f.service.shutdown();
});
test('retorno de pausa automática corta asigna Descanso sin formulario, largo pide motivo una vez',()=>{
 for(const duration of [120000,600000]){const f=fixture();f.advance(300000);f.service.command('auto-pause');f.advance(duration);assert.equal(f.sample(0),'review-pause');let v=f.service.command('review-pause');if(duration<=300000){assert.equal(v.phase.kind,'work');assert.equal(v.currentDay.pauseByCategory.Descanso,duration);}else{assert.ok(v.reviewPause);assert.equal(f.sample(0),null);v=f.service.command('classify-pause',{category:'Almorzar'});assert.equal(v.currentDay.pauseByCategory.Almorzar,duration);}assert.equal(v.currentDay.workMs,300000);assert.equal(v.phase.elapsedMs,0);f.service.shutdown();}
});
test('corregir detección falsa como Trabajo restaura tiempo y ciclo sin duplicación',()=>{
 const f=fixture();f.advance(300000);f.service.command('auto-pause');f.advance(600000);f.service.command('review-pause');const v=f.service.command('classify-pause',{destination:'work'});assert.equal(v.currentDay.workMs,900000);assert.equal(v.currentDay.pauseMs,0);assert.equal(v.phase.elapsedMs,900000);assert.throws(()=>f.service.command('classify-pause',{destination:'work'}));f.service.shutdown();
});
test('pausa manual y automática comparten total, categorías GYM y nuevo ciclo',()=>{
 const f=fixture();f.advance(60000);f.service.command('pause');f.advance(600000);f.service.command('resume');f.service.command('classify-pause',{category:'GYM'});f.advance(60000);f.service.command('auto-pause');f.advance(600000);f.service.command('review-pause');const v=f.service.command('classify-pause',{category:'GYM'});assert.equal(v.currentDay.pauseMs,1200000);assert.equal(v.currentDay.pauseByCategory.GYM,1200000);assert.equal(v.currentDay.workMs,120000);assert.equal(v.phase.elapsedMs,0);assert.equal(v.currentDay.leisureMs,0);f.service.shutdown();
});
