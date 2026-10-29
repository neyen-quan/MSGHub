const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isMessagingService,setMessagingAudioMuted,applyMessagingAudioMode,applyMessagingAudioPreferences}=require('../electron/audio-mode.cjs');
function makeView(){const result={muted:false,destroyed:false};result.webContents={isDestroyed:()=>result.destroyed,setAudioMuted:value=>{result.muted=value}};return result;}
test('Modo ON mutes both WhatsApp profiles and Telegram, including split views',()=>{
  const personal=makeView(),business=makeView(),telegram=makeView(),gmail=makeView();
  const views=new Map([['wa-personal',personal],['global-1::wa-work',business],['telegram',telegram],['gmail-main',gmail]]);
  assert.equal(applyMessagingAudioMode(views,true),3);
  assert.deepEqual([personal.muted,business.muted,telegram.muted,gmail.muted],[true,true,true,false]);
});
test('Modo OFF restores normal audio on every open messaging view',()=>{
  const views=new Map(['wa-personal','wa-work','telegram'].map(id=>[id,makeView()]));
  applyMessagingAudioMode(views,true);assert.equal(applyMessagingAudioMode(views,false),3);
  assert.deepEqual([...views.values()].map(v=>v.muted),[false,false,false]);
});
test('New WhatsApp/Telegram views inherit the current mode; unrelated views do not',()=>{
  for(const id of ['wa-personal','wa-work','telegram','split::wa-work']) {
    const v=makeView();assert.equal(setMessagingAudioMuted(v.webContents,id,true),true);assert.equal(v.muted,true);
  }
  const gmail=makeView();assert.equal(setMessagingAudioMuted(gmail.webContents,'gmail-main',true),false);assert.equal(gmail.muted,false);
});
test('Destroyed views are skipped safely',()=>{
  const dead=makeView();dead.destroyed=true;
  const live=makeView();assert.equal(applyMessagingAudioMode(new Map([['wa-personal',dead],['telegram',live]]),true),1);
  assert.equal(dead.muted,false);assert.equal(live.muted,true);
});
test('Messaging IDs carried in split layouts are recognized by their final segment',()=>{
  assert.equal(isMessagingService('global-2::wa-work'),true);
  assert.equal(isMessagingService('telegram'),true);
  assert.equal(isMessagingService('global-3::telegram-4'),true);
  assert.equal(isMessagingService('telegram-5'),false);
  assert.equal(isMessagingService('gpt-personal'),false);
});
test('per-account mute preferences leave every other messaging profile unchanged',()=>{
  const views=new Map(['wa-personal','wa-work','telegram','telegram-2','telegram-3','telegram-4'].map(id=>[id,makeView()]));
  assert.equal(applyMessagingAudioPreferences(views,['wa-personal','telegram-3']),6);
  assert.deepEqual([...views.values()].map(view=>view.muted),[true,false,false,false,true,false]);
  assert.equal(applyMessagingAudioPreferences(views,['wa-work']),6);
  assert.deepEqual([...views.values()].map(view=>view.muted),[false,true,false,false,false,false]);
});
