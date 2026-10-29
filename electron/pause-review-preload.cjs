const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pauseReview',{
  state:()=>ipcRenderer.invoke('pause-review-state'),
  save:payload=>ipcRenderer.invoke('pause-review-save',payload),
  cancel:()=>ipcRenderer.invoke('pause-review-cancel')
});
