const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('transition',{ready:()=>ipcRenderer.invoke('transition-ready'),cancel:()=>ipcRenderer.invoke('transition-cancel'),start:()=>ipcRenderer.invoke('transition-start'),state:fn=>ipcRenderer.on('transition-state',(_e,s)=>fn(s))});
