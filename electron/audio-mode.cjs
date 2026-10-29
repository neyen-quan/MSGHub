function isMessagingService(id) {
  const serviceId = id?.includes('::') ? id.split('::').at(-1) : id;
  return ['wa-personal', 'wa-work'].includes(serviceId) || /^telegram(?:-[2-4])?$/.test(serviceId || '');
}
function setMessagingAudioMuted(webContents, serviceId, enabled) {
  if (!isMessagingService(serviceId) || !webContents || webContents.isDestroyed()) return false;
  webContents.setAudioMuted(Boolean(enabled));
  return true;
}
function applyMessagingAudioMode(remoteViews, enabled) {
  let changed = 0;
  for (const [id, view] of remoteViews) {
    if (setMessagingAudioMuted(view.webContents, id, enabled)) changed++;
  }
  return changed;
}
function applyMessagingAudioPreferences(remoteViews, mutedIds = []) {
  const muted = new Set(Array.isArray(mutedIds) ? mutedIds : []);
  let changed = 0;
  for (const [id, view] of remoteViews) {
    const serviceId = id?.includes('::') ? id.split('::').at(-1) : id;
    if (isMessagingService(serviceId) && view?.webContents && !view.webContents.isDestroyed()) {
      view.webContents.setAudioMuted(muted.has(serviceId));
      changed++;
    }
  }
  return changed;
}
module.exports = { isMessagingService, setMessagingAudioMuted, applyMessagingAudioMode, applyMessagingAudioPreferences };
