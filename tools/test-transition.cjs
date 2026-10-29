const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process');
const root=path.resolve(process.env.MSGHUB_SOURCE_ROOT||path.join(__dirname,'..')),engine=require(path.join(root,'electron/desktop-update.cjs'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const value=fn();if(value)return value;await wait(100);}throw Error('Timeout de transición real MSG Hub');}
async function testTransition(){
 const filename=fs.readdirSync(path.join(root,'release')).find(n=>n.includes('-from-1.6.1-transition.zip'));if(!filename)return;
 const built=path.join(root,'.build/MSGHub'),home=path.join(root,'.qa/transition'),install=path.join(home,'MSGHub á space');fs.mkdirSync(path.join(install,'electron'),{recursive:true});
 const oldRuntime=path.join(install,'node_modules/electron/dist');fs.mkdirSync(oldRuntime,{recursive:true});fs.cpSync(path.join(built,'runtime'),oldRuntime,{recursive:true});fs.renameSync(path.join(oldRuntime,'MSGHubEngine.exe'),path.join(oldRuntime,'electron.exe'));
 execFileSync('cl.exe',['/nologo','/utf-8','/O1','/MT','/DUNICODE','/D_UNICODE','/D_CRT_SECURE_NO_WARNINGS','/Fo'+path.join(home,'legacy.obj'),path.join(__dirname,'legacy/launcher.c'),'/Fe'+path.join(install,'MSGHub.exe'),'/link','/SUBSYSTEM:WINDOWS','user32.lib'],{stdio:'inherit'});
 const profile=path.join(home,'profile','MSG Hub');fs.mkdirSync(profile,{recursive:true});
 const seed={version:1,cards:[{id:'local-note',topic:'Local project',title:'Synthetic preserved note',state:'En curso',actions:[],archived:false}],topicOrder:['Local project'],topicGroups:{Trabajo:['Local project'],Personal:[],Esports:[]},systemTopics:[],themeColors:{}};
 const timer={version:5,settings:{workMinutes:55,breakMinutes:5,autoPauseEnabled:false},days:{'2026-01-02':{workMs:7200000,pauseMs:600000,leisureMs:0,pauseByCategory:{Descanso:600000},pauseDetails:{}}},phase:null,pendingPauses:[]};
 fs.writeFileSync(path.join(profile,'work-timer.json'),JSON.stringify(timer));
 const server=path.join(root,'electron/desktop-ui-server.cjs');
 const legacy=`const {app,BrowserWindow,session}=require('electron');const fs=require('node:fs'),path=require('node:path');const gmailAccounts = {'gmail-neyen':'account@example.invalid'};app.setPath('userData',${JSON.stringify(profile)});app.disableHardwareAcceleration();app.whenReady().then(async()=>{await require(${JSON.stringify(server)}).startDesktopUi({root:${JSON.stringify(built)}});const win=new BrowserWindow({webPreferences:{contextIsolation:true}});await win.loadURL('http://127.0.0.1:5174');await win.webContents.executeJavaScript(${JSON.stringify("localStorage.setItem('msghub-ci-preserved','retained');localStorage.setItem('msghub-kanban-v1',"+JSON.stringify(JSON.stringify(seed))+");localStorage.setItem('msghub-muted-messaging-apps','[\\\"wa-personal\\\"]')")});const cookies=session.fromPartition('persist:workhub-wa-personal').cookies;await cookies.set({url:'https://example.com',name:'msghub-ci',value:'retained',expirationDate:Date.now()/1000+86400});await cookies.flushStore();fs.writeFileSync(${JSON.stringify(path.join(home,'seed-ready'))},'ready');app.quit();});`;
 fs.writeFileSync(path.join(install,'electron/main.cjs'),legacy);fs.writeFileSync(path.join(install,'package.json'),JSON.stringify({name:'msg-hub-desktop',version:'1.6.1',main:'electron/main.cjs'}));fs.copyFileSync(path.join(root,'electron/desktop-bootstrap.cjs'),path.join(install,'electron/desktop-bootstrap.cjs'));fs.mkdirSync(path.join(install,'src'));fs.writeFileSync(path.join(install,'src/kanban-seed.json'),JSON.stringify(seed));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const seeded=spawn(path.join(install,'MSGHub.exe'),[],{cwd:install,env,stdio:'ignore'});await until(()=>fs.existsSync(path.join(home,'seed-ready')));if(seeded.exitCode===null)await new Promise(r=>seeded.once('exit',r));await wait(1500);
 // Prepare with the exact legacy validator and restart worker, not the new updater.
 const legacyEngine=require('./legacy/desktop-update.cjs'),archive=fs.readFileSync(path.join(root,'release',filename));legacyEngine.validatePatch(archive,'1.6.1');
 const pending=legacyEngine.prepare(install,archive,'1.6.1'),j=JSON.parse(fs.readFileSync(path.join(pending.job,'journal.json')));legacyEngine.apply(pending.job,j);
 // Instrument disposable payload only, then describe those exact test bytes.
 const payload=path.join(install,'electron/transition/app'),invPath=path.join(payload,'assets/msghub-installation.json'),inv=JSON.parse(fs.readFileSync(invPath));
 for(const name of ['electron/main.cjs','electron/installer-main.cjs']){const f=path.join(payload,name),hook=path.join(__dirname,'packaged-test-hook.cjs');fs.writeFileSync(f,'require('+JSON.stringify(hook)+');\n'+fs.readFileSync(f));const b=fs.readFileSync(f);inv.files[name]={sha256:engine.sha(b),size:b.length};}fs.writeFileSync(invPath,JSON.stringify(inv,null,2)+'\n');
 const wizard=path.join(install,'electron/transition/wizard.cjs');fs.writeFileSync(wizard,'require('+JSON.stringify(path.join(__dirname,'transition-test-hook.cjs'))+');\n'+fs.readFileSync(wizard));
 // Simulate the old updater's final handshake exactly: it owns the active job
 // until the wizard has loaded, then releases it before the migration begins.
 fs.writeFileSync(path.join(pending.job,'healthy.json'),JSON.stringify({id:j.id,version:inv.version}));j.state='complete';legacyEngine.atomicJson(path.join(pending.job,'journal.json'),j);fs.rmSync(path.join(install,'.msghub-updates/active.json'));
 const qaEnv={...env,MSGHUB_QA_HOME:home,MSGHUB_QA_INSTALL:install,MSGHUB_QA_FROM:'1.6.1'};
 const child=spawn(path.join(install,'MSGHub.exe'),[],{cwd:install,env:qaEnv,stdio:'ignore'});child.on('error',e=>fs.writeFileSync(path.join(home,'child-error.json'),JSON.stringify({error:e.stack})));
 try{
  await until(()=>{const p=path.join(install,'.msghub-updates/result.json');return fs.existsSync(p)&&JSON.parse(fs.readFileSync(p)).ok;},180000);
  const receipt=await until(()=>{const p=path.join(home,'launch-'+inv.version+'.json');return fs.existsSync(p)&&JSON.parse(fs.readFileSync(p));});assert.equal(receipt.local,'retained');assert.equal(receipt.cookie,'retained');assert.equal(receipt.root,install);
  const cfg=JSON.parse(fs.readFileSync(path.join(profile,'private-config.json')));assert.equal(cfg.emails['gmail-neyen'],'account@example.invalid');assert.equal(cfg.kanbanSeed.cards[0].id,'local-note');assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'work-timer.json'))).days['2026-01-02'].workMs,7200000);
  await engine.verifyInventory(install,inv);assert.ok(JSON.parse(fs.readFileSync(path.join(home,'progress-lock.json'))).locked);fs.writeFileSync(path.join(root,'.qa/legacy-transition.json'),JSON.stringify({ok:true,realLegacyLayout:true,exactArchive:true,localRuntimeReuse:true,privateConfigLocal:true,cookiesAndLocalStoragePreserved:true,tasksAndTimerPreserved:true,standaloneInstaller:true}));
 }catch(error){for(const f of fs.readdirSync(path.join(install,'.msghub-updates'))){const p=path.join(install,'.msghub-updates',f,'journal.json');if(fs.existsSync(p))fs.copyFileSync(p,path.join(home,'transition-journal.json'));}throw error;}finally{fs.writeFileSync(path.join(home,'stop'),'stop');await wait(2500);try{child.kill();}catch{}}
}
module.exports={testTransition};
