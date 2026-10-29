const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('transition',{cancel:()=>ipcRenderer.invoke('transition-cancel'),start:()=>ipcRenderer.invoke('transition-start'),state:fn=>ipcRenderer.on('transition-state',(_e,s)=>fn(s))});
