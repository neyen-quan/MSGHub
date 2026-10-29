const test = require('node:test');
const assert = require('node:assert/strict');
const rules = import('../src/kanban-rules.mjs');
const cards = Array.from({length:3}, (_, i) => ({ id: String(i), topic: 'Rina', state: 'En curso', order:i+1 }));
test('solo En curso cuenta: bloquea la cuarta al crear, mover, cambiar grupo o restaurar; Pendiente y Futuro son ilimitadas', async () => {
 const {limitError,activeCount,saveTask}=await rules;
 assert.ok(limitError(cards,{id:'new',topic:'Rina',state:'En curso'}));
 const archived={id:'a',topic:'Rina',state:'En curso',archived:true};
 assert.ok(limitError([...cards,archived],{...archived,archived:false}));
 for(const state of ['Pendiente','Futuro','Completado'])assert.equal(limitError(cards,{id:'new',topic:'Rina',state}),'');
 assert.equal(limitError(cards,{id:'new',topic:'Otro',state:'En curso'}),'');
 assert.equal(activeCount([...cards,{id:'p',topic:'Rina',state:'Pendiente'},archived],'Rina'),3);
 let current=cards;
 for(let i=0;i<10;i++) current=saveTask(current,{id:`pending-${i}`,topic:'Rina',state:'Pendiente'}).cards;
 assert.equal(current.length,13);
 const failed=saveTask(current,{...current[3],state:'En curso'});assert.ok(failed.error);assert.deepEqual(failed.cards,current);
 assert.ok(limitError([...cards,{id:'other',topic:'Otro',state:'En curso'}],{id:'other',topic:'Rina',state:'En curso'}));
});
test('grupos anteriores sobre el límite permiten editar y completar sin generar una cuarta activa', async () => {
 const {limitError,saveTask,activeCount}=await rules;
 const old=[...cards,{id:'4',topic:'Rina',state:'En curso'}, {id:'p',topic:'Rina',state:'Pendiente'}];
 assert.equal(limitError(old,{...cards[0],title:'Editar'}),'');
 assert.equal(limitError(old,{...cards[0],state:'Pendiente'}),'');
 let result=saveTask(old,{...cards[0],state:'Completado'});
 assert.equal(activeCount(result.cards,'Rina'),3);assert.equal(result.promoted,null);assert.equal(result.cards.find(c=>c.id==='p').state,'Pendiente');
 result=saveTask(result.cards,{...cards[1],state:'Completado'});assert.equal(result.promoted.id,'p');assert.equal(activeCount(result.cards,'Rina'),3);
});
test('completar En curso promueve la primera pendiente del mismo grupo, mantiene fechas y checklist y no usa Futuro ni archivadas',async()=>{
 const {saveTask,activeCount}=await rules;
 const queue=[...cards,{id:'p2',topic:'Rina',state:'Pendiente',order:20},{id:'other',topic:'Otro',state:'Pendiente',order:0},{id:'future',topic:'Rina',state:'Futuro',order:-2},{id:'archived',topic:'Rina',state:'Pendiente',archived:true,order:-1},{id:'p1',topic:'Rina',state:'Pendiente',title:'Primera',date:'2026-11-01',actions:[{text:'Hacer',done:false}],order:10}];
 const result=saveTask(queue,{...cards[0],state:'Completado'},'2026-10-15T01:00:00Z');
 assert.equal(result.promoted.id,'p1');assert.equal(activeCount(result.cards,'Rina'),3);assert.equal(result.promoted.date,'2026-11-01');assert.deepEqual(result.promoted.actions,queue.at(-1).actions);
 assert.equal(result.cards.find(c=>c.id==='0').completedAt,'2026-10-15T01:00:00Z');
 assert.equal(result.cards.find(c=>c.id==='p2').state,'Pendiente');assert.equal(result.cards.find(c=>c.id==='future').state,'Futuro');assert.equal(result.cards.find(c=>c.id==='other').state,'Pendiente');
 assert.deepEqual(queue[0],cards[0]);
});
test('edición repetida de completada, crear completada y archivar no promueven tareas; sin pendientes Futuro permanece igual',async()=>{
 const {saveTask}=await rules;
 const old=[...cards,{id:'p',topic:'Rina',state:'Pendiente'}];
 let r=saveTask(old,{...cards[0],state:'Completado'});assert.equal(r.promoted.id,'p');
 r=saveTask(r.cards,{...r.cards[0],title:'Editar terminada'});assert.equal(r.promoted,null);
 r=saveTask(old,{id:'new',topic:'Rina',state:'Completado'});assert.equal(r.promoted,null);
 r=saveTask(old,{...cards[0],archived:true});assert.equal(r.promoted,null);
 r=saveTask([...cards,{id:'f',topic:'Rina',state:'Futuro'}],{...cards[0],state:'Completado'});assert.equal(r.promoted,null);assert.equal(r.cards.at(-1).state,'Futuro');
});
test('orden de cola editable define la siguiente promoción; cambia solo el grupo y estado elegidos',async()=>{
 const {reorderTask,saveTask}=await rules;
 const old=[...cards,{id:'p1',topic:'Rina',state:'Pendiente',order:1},{id:'p2',topic:'Rina',state:'Pendiente',order:2},{id:'other',topic:'Otro',state:'Pendiente',order:1}];
 const reordered=reorderTask(old,'p2',-1);assert.equal(reordered.find(c=>c.id==='p2').order,1);assert.equal(reordered.find(c=>c.id==='other').order,1);assert.equal(old.find(c=>c.id==='p2').order,2);
 assert.equal(saveTask(reordered,{...cards[0],state:'Completado'}).promoted.id,'p2');
 assert.deepEqual(reorderTask(reordered,'p2',-1),reordered);
 assert.equal(saveTask(reordered,{...cards[0],state:'Pendiente'}).promoted,null);
});
test('columnas quedan Pendiente, En curso, Completado, Futuro; migración conserva tarjetas sin activarlas',async()=>{
 const {STATES,initializeBoard}=await rules;assert.deepEqual(STATES,['Pendiente','En curso','Completado','Futuro']);
 const seed=require('../src/kanban-seed.json');assert.deepEqual(initializeBoard(seed).cards,seed.cards);
});
test('creación por sección, nombres únicos y migración local sin cambiar tarjetas ni ocultos', async () => {
 const {initializeBoard,addTopic}=await rules;
 const seed=require('../src/kanban-seed.json');
 const next=initializeBoard({...seed,hiddenTopics:['Local project']},[{name:'Local project',group:'Trabajo'}]);
 assert.deepEqual(next.cards,seed.cards);
 assert.ok(next.topicGroups.Trabajo.includes('Local project'));
 assert.deepEqual(initializeBoard(next),next);
 assert.deepEqual(next.hiddenTopics,['Local project']);
 assert.throws(()=>addTopic(next,' local project ','Personal'));
 for(const group of ['Trabajo','Personal','Esports','Sistema']) {
  const board=addTopic(next,`Nuevo ${group}`,group);
  assert.ok((group==='Sistema'?board.systemTopics:board.topicGroups[group]).includes(`Nuevo ${group}`));
 }
});
test('último check completa la tarjeta y activa exactamente una pendiente con fecha de finalización',async()=>{
 const {saveTask,allActionsDone,activeCount}=await rules;
 const active={...cards[0],actions:[{text:'Primera',done:true},{text:'Última',done:false}]};
 const board=[active,...cards.slice(1),{id:'p',topic:'Rina',state:'Pendiente',order:1}];
 const completed={...active,actions:active.actions.map(a=>({...a,done:true}))};
 assert.equal(allActionsDone(active),false);assert.equal(allActionsDone(completed),true);
 const r=saveTask(board,completed,'2026-10-15T01:00:00Z');
 assert.equal(r.cards[0].state,'Completado');assert.equal(r.cards[0].completedAt,'2026-10-15T01:00:00Z');assert.equal(r.promoted.id,'p');assert.equal(activeCount(r.cards,'Rina'),3);
 assert.equal(saveTask(r.cards,r.cards[0]).promoted,null);
});
test('checks vacíos o incompletos no completan; notas Pendiente o Futuro con todos sus checks pasan a Completado sin activar otra',async()=>{
 const {saveTask,allActionsDone}=await rules;
 for(const actions of [[],[{text:'',done:true}],[{text:'Real',done:false}]])assert.equal(allActionsDone({actions}),false);
 for(const state of ['Pendiente','Futuro']){
  const old={id:'note',topic:'Rina',state,actions:[{text:'Hacer',done:false}]};
  const r=saveTask([...cards,old],{...old,actions:[{text:'Hacer',done:true}]});assert.equal(r.cards.at(-1).state,'Completado');assert.equal(r.promoted,null);
 }
 const archived={id:'a',topic:'Rina',state:'En curso',archived:true,actions:[{text:'Listo',done:true}]};
 assert.equal(saveTask([archived],archived).cards[0].state,'En curso');
});
