const path=require('node:path');
const fs=require('node:fs');
const APP_ID='agency.neyen.msghub';
function applyDesktopBranding({app,shell,win,exe=process.execPath,platform=process.platform}) {
 const icon=path.join(__dirname,'../assets/msghub-taskbar.ico');
 win.setIcon(icon);
 if(platform!=='win32')return;
 win.setAppDetails({appId:APP_ID,appIconPath:icon,appIconIndex:0,relaunchCommand:`"${exe}"`,relaunchDisplayName:'MSGHub'});
 const options={target:exe,cwd:path.dirname(exe),icon,iconIndex:0,appUserModelId:APP_ID,description:'MSGHub · Espacio de trabajo'};
 const update=(file,create=false)=>{
  try {
   const exists=fs.existsSync(file);
   if(exists){
    const previous=shell.readShortcutLink(file);
    if(previous.appUserModelId && previous.appUserModelId!==APP_ID)return;
    const sameTarget=path.resolve(previous.target).toLowerCase()===path.resolve(exe).toLowerCase();
    // AppUserModelID identifies this product even after moving its folder.
    // Other hubs and unrelated shortcuts are never matched by filename alone.
    const ours=previous.appUserModelId===APP_ID;
    const legacyDesktop=create&&!previous.appUserModelId&&!fs.existsSync(previous.target)&&path.basename(previous.target).toLowerCase()==='msghub.exe';
    if(!sameTarget&&!ours&&!legacyDesktop)return;
   }
   if(exists || create) shell.writeShortcutLink(file,exists?'update':'create',options);
  }catch(error){console.warn('No se pudo actualizar el acceso directo de MSGHub:',error.message);}
 };
 update(path.join(app.getPath('desktop'),'MSGHub Escritorio.lnk'),true);
 // Refresh only this executable's existing pinned shortcut, preserving others.
 const pinned=path.join(app.getPath('appData'),'Microsoft','Internet Explorer','Quick Launch','User Pinned','TaskBar');
 const menus=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs');
 const visited=new Set();
 function scan(folder,depth=0){
  if(depth>6||visited.has(folder))return;visited.add(folder);
  try{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
   const name=typeof entry==='string'?entry:entry.name,file=path.join(folder,name);
   if(typeof entry!=='string'&&entry.isSymbolicLink())continue;
   if(typeof entry!=='string'&&entry.isDirectory())scan(file,depth+1);
   else if(name.toLowerCase().endsWith('.lnk'))update(file);
  }}catch{}
 }
 scan(app.getPath('desktop'));scan(menus);scan(pinned);

}
module.exports={applyDesktopBranding};
