// WhatsApp's own notification preference store. No media/audio APIs are muted.
// Discover boolean get/set pairs in the notification module, rather than guessing
// module export names that can change between WhatsApp releases.
async function setWhatsAppPreferences(enabled, profileId) {
  const key = 'msghub-notification-prefs-v104-' + profileId;
  let prefs;
  try { prefs = window.require('WAWebUserPrefsNotifications'); }
  catch { return { ok: false, unsupported: true, error: 'WhatsApp todavía no expuso sus ajustes de notificaciones.' }; }
  if (!prefs) return { ok: false, unsupported: true, error: 'Ajustes de WhatsApp no disponibles.' };
  const pairs = [];
  for (const getter of Object.keys(prefs)) {
    if (!/^get/.test(getter) || typeof prefs[getter] !== 'function') continue;
    const suffix = getter.slice(3), setter = 'set' + suffix;
    // These are NOT the notification enable/sound switches.
    if (/offline|background|preview|permission|push|last|timestamp|sync|duration|disabled|muted|mute|hide|silent|block/i.test(suffix)) continue;
    if (!/notification|sound/i.test(suffix) || typeof prefs[setter] !== 'function') continue;
    if (prefs[getter].length !== 0 || prefs[setter].length > 1) continue;
    try {
      const value = await prefs[getter]();
      if (typeof value === 'boolean') pairs.push({ getter, setter, suffix, value });
    } catch { /* Never write an unreadable preference. */ }
  }
  const covers = (kind, category) => pairs.some(p => {
    const sound = /sound/i.test(p.suffix);
    if (kind === 'sound' ? !sound : sound || !/notification/i.test(p.suffix)) return false;
    return (category.source !== 'call' && /global/i.test(p.suffix)) || category.test(p.suffix);
  });
  // A partial module must not be reported as a successfully silent account.
  const complete = [/message|msg|chat/i, /group/i, /call/i].every(category =>
    covers('sound', category) && covers('notification', category));
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); }
  catch { return { ok: false, error: 'No se pudieron leer los ajustes guardados.' }; }
  if (!complete && (enabled || !saved)) return { ok: false, unsupported: true, error: 'Esta versión no expone todos los controles de mensajes, grupos y llamadas.' };
  if (!enabled && !saved) return { ok: true, changed: [], method: 'preferences' };
  if (saved && (saved.version !== 1 || !Array.isArray(saved.pairs))) return { ok: false, error: 'El respaldo de notificaciones no tiene un formato válido.' };
  const original = saved || { version: 1, pairs: pairs.map(p => ({ getter:p.getter, setter:p.setter, value:p.value })) };
  const targets = enabled ? pairs : original.pairs;
  for (const p of targets) {
    if (typeof prefs[p.getter] !== 'function' || typeof prefs[p.setter] !== 'function') return { ok: false, error: 'WhatsApp cambió un control guardado: ' + p.getter };
  }
  const confirmed = async (getter, value) => {
    const deadline = Date.now() + 2000;
    do {
      if (await prefs[getter]() === value) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (Date.now() < deadline);
    return false;
  };
  const before = [];
  try {
    // Retain the first snapshot across retries, reloads and restarts.
    if (enabled) {
      for (const p of pairs) if (!original.pairs.some(v => v.getter === p.getter)) original.pairs.push({ getter:p.getter, setter:p.setter, value:p.value });
      localStorage.setItem(key, JSON.stringify(original));
    }
    for (const p of targets) {
      const value = await prefs[p.getter]();
      if (typeof value !== 'boolean') throw new Error('No pude leer ' + p.getter);
      before.push({ ...p, value });
      const desired = enabled ? false : p.value;
      if (value !== desired) await prefs[p.setter](desired);
      if (!await confirmed(p.getter, desired)) throw new Error('WhatsApp no confirmó ' + p.getter);
    }
    // Read every setting again after all setters finish (detect coupled setters).
    for (const p of targets) if (await prefs[p.getter]() !== (enabled ? false : p.value)) throw new Error('WhatsApp revirtió ' + p.getter);
    if (!enabled) localStorage.removeItem(key);
    return { ok: true, method: 'preferences', changed: targets.map(p => p.getter) };
  } catch (error) {
    let rollbackOk = true;
    for (const p of before.reverse()) {
      try { await prefs[p.setter](p.value); if (await prefs[p.getter]() !== p.value) rollbackOk = false; }
      catch { rollbackOk = false; }
    }
    // Keep snapshot after any failure so OFF can always retry restoration.
    return { ok: false, error: error.message, rollbackOk };
  }
}
module.exports = { setWhatsAppPreferences };
