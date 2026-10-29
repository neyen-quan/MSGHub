const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {startDesktopUi,UI_ORIGIN}=require('../electron/desktop-ui-server.cjs');
async function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'MSGHub UI '));fs.mkdirSync(path.join(root,'dist/assets'),{recursive:true});fs.writeFileSync(path.join(root,'dist/index.html'),'<h1>MSGHub</h1>');fs.writeFileSync(path.join(root,'dist/assets/app.js'),'console.log("built")');const ui=await startDesktopUi({root,port:0});t.after(()=>{ui.close();fs.rmSync(root,{recursive:true,force:true});});return {root,...ui};}
test('la versión de escritorio conserva el origen exacto del Kanban anterior y sirve la interfaz compilada sin Vite',async t=>{
 assert.equal(UI_ORIGIN,'http://127.0.0.1:5174');const ui=await fixture(t);const r=await fetch(ui.url+'/');assert.equal(r.status,200);assert.match(await r.text(),/MSGHub/);assert.equal(r.headers.get('cache-control'),'no-store');const a=await fetch(ui.url+'/assets/app.js');assert.equal(a.status,200);assert.match(a.headers.get('content-type'),/javascript/);
});
test('no sirve el perfil, código Electron, rutas ascendentes ni solicitudes con otro Host',async t=>{
 const ui=await fixture(t);fs.writeFileSync(path.join(ui.root,'work-timer.json'),'private');
 for(const name of ['work-timer.json','electron/main.cjs','assets/%2e%2e%2f%2e%2e%2fwork-timer.json'])assert.notEqual((await fetch(ui.url+'/'+name)).status,200);
 const status=await new Promise((resolve,reject)=>{http.get(ui.url,{headers:{Host:'other.local'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(status,403);
});
test('un puerto ocupado falla sin elegir otro origen ni reiniciar las preferencias',async t=>{
 const ui=await fixture(t);await assert.rejects(()=>startDesktopUi({root:ui.root,port:ui.server.address().port}),/Cerrá el MSG Hub anterior/);
});
test('el ejecutable y la integración conservan userData, origen, identidad y no arrancan npm',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8'),launcher=fs.readFileSync(path.join(__dirname,'../native/msghub-launcher.c'),'utf8');
 assert.match(main,/app\.setPath\('userData', path\.join\(app\.getPath\('appData'\), 'MSG Hub'\)\)/);
 assert.match(main,/startDesktopUi/);assert.match(main,/win\.loadURL\(desktopUi.url\)/);assert.match(main,/requestSingleInstanceLock/);assert.match(main,/applyDesktopBranding/);
 assert.match(launcher,/CREATE_NO_WINDOW/);assert.match(launcher,/MSGHubEngine.exe/);assert.doesNotMatch(launcher,/npm|cmd\.exe|powershell/i);
});
