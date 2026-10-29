const { spawn } = require('node:child_process');
const path = require('node:path');

// Policy is independent of Electron so threshold and false-positive cases can be tested.
function createIdlePolicy({ now = Date.now, thresholdMs = 300000 } = {}) {
  let protectedUntil = now() + thresholdMs;
  return ({ state, idleSeconds, mediaPlaying }) => {
    const time = now();
    if (mediaPlaying) protectedUntil = time + thresholdMs;
    if (state.phase?.kind === 'pause' && state.phase.automatic && !state.phase.returnNotified && time - idleSeconds * 1000 > state.phase.autoSince + 1000) return 'review-pause';
    if (state.settings.autoPauseEnabled !== false && state.phase?.kind === 'work' && state.phase.startedAt && Number.isFinite(idleSeconds) && idleSeconds >= thresholdMs / 1000 && time >= protectedUntil && !mediaPlaying) return 'auto-pause';
    return null;
  };
}
function startActivityMonitor({ powerMonitor, timerService, remoteViews, onReview, onStatus = () => {} }) {
  let stopped = false, busy = false, worker, retry, lastStatus = 0, buffer = '', status = { available:false, playing:false };
  const policy = createIdlePolicy();
  function launch() {
    if (stopped || process.platform !== 'win32') return;
    worker = spawn(path.join(process.env.WINDIR || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'), ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'media-status.ps1')], {windowsHide:true,stdio:['ignore','pipe','ignore']});
    worker.stdout.on('data',chunk=>{
      buffer += chunk.toString();
      let end;
      while((end=buffer.indexOf('\n'))>=0) { const line=buffer.slice(0,end).trim(); buffer=buffer.slice(end+1); try {status=JSON.parse(line);lastStatus=Date.now();}catch{} }
      if(buffer.length>10000) buffer='';
    });
    worker.on('error',()=>{status={available:false,playing:false};});
    worker.on('close',()=>{status={available:false,playing:false};if(!stopped) {retry=setTimeout(launch,30000);retry.unref?.();}});
  }
  launch();
  async function tick() {
    if (stopped || busy) return;
    busy=true;
    try {
      const state=timerService.getState();
      const nativeAvailable=status.available && Date.now()-lastStatus<10000;
      onStatus({available:nativeAvailable});
      if(!state.phase) return;
      const idleSeconds=powerMonitor.getSystemIdleTime();
      let embeddedPlaying=false;
      if(state.phase.kind==='work' && idleSeconds>=290) {
        const results=await Promise.all([...remoteViews.values()].filter(v=>!v.webContents.isDestroyed()).map(v=>Promise.race([
          v.webContents.executeJavaScript("Array.from(document.querySelectorAll('video,audio')).some(m => !m.paused && !m.ended && m.readyState >= 2)").catch(()=>false),
          new Promise(resolve=>{const t=setTimeout(()=>resolve(false),1200);t.unref?.();})
        ])));
        embeddedPlaying=results.some(Boolean);
      }
      if(stopped)return;
      // Read inactivity again after asynchronous media checks so a user's return wins.
      const action=policy({state:timerService.getState(),idleSeconds:powerMonitor.getSystemIdleTime(),mediaPlaying:embeddedPlaying || (nativeAvailable && status.playing)});
      if(action){timerService.command(action); if(action==='review-pause')onReview();}
    }catch(error){console.error('[MSGHub activity]',error.message);}finally{busy=false;}
  }
  const timer=setInterval(tick,5000);timer.unref?.();tick();
  const suspend=()=>{if(timerService.getState().phase?.kind==='work')timerService.command('auto-pause');};
  powerMonitor.on('suspend',suspend);
  return ()=>{stopped=true;clearInterval(timer);clearTimeout(retry);worker?.kill();powerMonitor.removeListener('suspend',suspend);};
}
module.exports={createIdlePolicy,startActivityMonitor};
