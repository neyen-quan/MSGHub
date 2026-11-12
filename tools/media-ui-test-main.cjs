const { app, BrowserWindow, Menu, clipboard } = require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const [root,report]=process.argv.slice(2),wait=ms=>new Promise(r=>setTimeout(r,ms));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 try {
  const win=new BrowserWindow({width:1000,height:800,show:true,webPreferences:{contextIsolation:true,sandbox:true}}),wc=win.webContents;
  await wc.loadURL('http://127.0.0.1:'+await new Promise(resolve=>{
   const server=require('node:http').createServer((_q,r)=>r.end('<style>body{margin:0}#columns{display:flex;height:700px}#side{width:300px;height:700px;background:#222}#main{flex:1;height:700px}#viewer{position:fixed;inset:0;z-index:999;background:#111;display:none}img{width:900px;height:700px}</style><div id="columns"><div id="side">Chats</div><div id="main">Chat</div></div><div id="viewer"><img id="photo"></div>'));
   server.listen(0,'127.0.0.1',()=>resolve(server.address().port));
  }));
  const {installSidebar}=require(path.join(root,'electron/whatsapp-sidebar.cjs'));
  await wc.executeJavaScript(`(${installSidebar.toString()})('wa-personal')`);await wait(400);
  const before=await wc.executeJavaScript("(()=>{const e=document.querySelector('#workhub-wa-sidebar-resizer-v2'),s=getComputedStyle(e);return {border:s.borderLeftWidth,background:s.backgroundColor,display:s.display}})()");
  assert.equal(before.border,'0px');assert.equal(before.background,'rgba(0, 0, 0, 0)');assert.equal(before.display,'block');
  wc.sendInputEvent({type:'mouseDown',x:299,y:350,button:'left',clickCount:1});wc.sendInputEvent({type:'mouseMove',x:390,y:350});wc.sendInputEvent({type:'mouseUp',x:390,y:350,button:'left',clickCount:1});await wait(350);
  assert.ok(Number(await wc.executeJavaScript("localStorage.getItem('workhub-wa-sidebar-width-v2-wa-personal')"))>300);
  await wc.executeJavaScript("(async()=>{const c=document.createElement('canvas');c.width=10;c.height=10;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,10,10);photo.src=URL.createObjectURL(await new Promise(r=>c.toBlob(r)));await photo.decode();viewer.style.display='block'})()");await wait(400);
  assert.equal(await wc.executeJavaScript("document.querySelector('#workhub-wa-sidebar-resizer-v2').style.display"),'none');
  let template,popup=false;const build=Menu.buildFromTemplate.bind(Menu);
  Menu.buildFromTemplate=items=>{template=items;const menu=build(items),open=menu.popup.bind(menu);menu.popup=options=>{popup=true;open(options);setTimeout(()=>menu.closePopup(),100);};return menu;};
  require(path.join(root,'electron/media-context-menu.cjs')).registerMediaContextMenu(wc);
  clipboard.clear();wc.sendInputEvent({type:'mouseDown',x:500,y:300,button:'right',clickCount:1});wc.sendInputEvent({type:'mouseUp',x:500,y:300,button:'right',clickCount:1});await wait(500);
  assert.ok(popup);assert.ok(template.some(i=>i.label==='Copiar imagen'));template.find(i=>i.label==='Copiar imagen').click();await wait(400);assert.equal(clipboard.readImage().isEmpty(),false);
  const downloaded=new Promise((resolve,reject)=>{wc.session.once('will-download',(_e,item)=>{item.setSavePath(path.join(path.dirname(report),'media-test.png'));item.once('done',(_e,state)=>state==='completed'?resolve():reject(Error(state)));});});
  template.find(i=>i.label==='Guardar archivo como…').click();await downloaded;
  await wc.executeJavaScript("viewer.style.display='none'");await wait(400);assert.equal(await wc.executeJavaScript("document.querySelector('#workhub-wa-sidebar-resizer-v2').style.display"),'block');
  fs.writeFileSync(report,JSON.stringify({ok:true,nativeMenu:true,imageClipboard:true,blobDownload:true,invisibleResizableHandle:true,viewerDoesNotIntercept:true}));app.exit(0);
 }catch(error){fs.writeFileSync(report,JSON.stringify({ok:false,error:error.stack}));app.exit(1);}
});setTimeout(()=>{fs.writeFileSync(report,JSON.stringify({ok:false,error:'Media UI timeout'}));app.exit(2);},30000).unref();
