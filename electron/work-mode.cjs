const { setWhatsAppPreferences } = require('./whatsapp-preferences.cjs');
// WhatsApp: native notification preferences with a verified-control UI fallback.
// Telegram: a separate filter for its bundled notification and ringing assets.

async function applyWhatsAppWorkMode(webContents, enabled, profileId) {
  if (!webContents || webContents.isDestroyed()) return { ok: false, service: profileId, error: 'La vista no está disponible.' };
  const legacy = await webContents.executeJavaScript(`Boolean(localStorage.getItem(${JSON.stringify('msghub-workmode-original-' + profileId)}))`).catch(() => false);
  if (!enabled && !legacy) {
    const saved = await webContents.executeJavaScript(`Boolean(localStorage.getItem(${JSON.stringify('msghub-notification-prefs-v104-' + profileId)}))`).catch(() => true);
    if (!saved) return {ok:true, service:profileId, enabled, changed:[]};
  }
  if (!legacy) {
    const native = await webContents.executeJavaScript(`(${setWhatsAppPreferences.toString()})(${JSON.stringify(enabled)},${JSON.stringify(profileId)})`).catch(error => ({ok:false, error:error.message}));
    if (!native.unsupported) return { ...native, service: profileId, enabled };
  }
  const script = `(${async function (enabled, profileId) {
    const norm = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const findText = labels => {
      const wanted = labels.map(norm);
      return [...document.querySelectorAll('button,[role="button"],[role="menuitem"],a,[tabindex],div,span')]
        .filter(el => visible(el) && [el.innerText, el.getAttribute('aria-label'), el.title].some(value => wanted.includes(norm(value))))
        .sort((a,b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] || null;
    };
    const clickText = async labels => {
      let el = findText(labels);
      if (!el) return false;
      el.click();
      await wait(250);
      return true;
    };
    const switchFor = labels => {
      const text = findText(labels);
      if (!text) return null;
      let row = text;
      for (let i=0; i<8 && row; i++, row=row.parentElement) {
        const selector = 'input[type="checkbox"],[role="switch"],[role="checkbox"],[aria-checked],button[data-state]';
        const controls = [...row.querySelectorAll(selector)].filter(el => !el.parentElement?.closest(selector));
        if (row.matches(selector)) return row;
        if (controls.length === 1) return controls[0];
        if (controls.length > 1) return null;
      }
      return null;
    };
    const stateOf = control => {
      if (!control) return null;
      if (control.matches('input[type="checkbox"]')) return control.checked;
      const value = control.getAttribute('aria-checked') ?? control.getAttribute('data-state') ?? control.getAttribute('aria-pressed');
      if (value === 'true' || value === 'checked' || value === 'on') return true;
      if (value === 'false' || value === 'unchecked' || value === 'off') return false;
      return null;
    };
    const setSwitch = async (labels, value) => {
      const control = switchFor(labels);
      const state = stateOf(control);
      if (state === null) throw new Error('No pude leer el control: ' + labels[0]);
      if (state !== value) {
        if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error('El control está deshabilitado: ' + labels[0]);
        control.click();
        await until(() => stateOf(switchFor(labels)) === value, labels[0]);
      }
      const after = stateOf(switchFor(labels));
      if (after !== value) throw new Error('WhatsApp no confirmó el cambio de: ' + labels[0]);
      return state;
    };
    const until = async (fn, label, timeout = 6000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) { const result = fn(); if (result) return result; await wait(120); }
      throw new Error('WhatsApp no mostró ' + label + '.');
    };
    const categoriesVisible = () => findText(['Messages','Mensajes']) && findText(['Groups','Grupos']) && findText(['Calls','Llamadas']);
    const goBack = async () => {
      const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
      const back = buttons.find(el => /^(back|volver|atrás)(\s|$)/i.test(el.getAttribute('aria-label') || el.title || ''))
        || buttons.find(el => el.querySelector('[data-icon="back"],[data-icon="back-refreshed"]'));
      if (!back) throw new Error('No encontré la flecha para volver a Notificaciones.');
      back.click();
      await until(categoriesVisible, 'la lista de notificaciones');
    };
    const key = 'msghub-workmode-original-' + profileId;
    try {
      // Distinguish Settings home, a category detail and the categories list.
      if (!categoriesVisible()) {
        const inSettingsHome = () => findText(['Privacy','Privacidad']) && findText(['Chats','Chats']) && findText(['Notifications','Notificaciones']);
        if (stateOf(switchFor(['Play sound','Reproducir sonido','Play sound for incoming calls','Reproducir sonido de llamadas entrantes'])) !== null) {
          await goBack();
        } else {
          if (!inSettingsHome()) {
            const settings = await until(() => [...document.querySelectorAll('button,[role="button"],[aria-label],[title]')]
              .find(el => visible(el) && [el.getAttribute('aria-label'),el.title].some(value => /^(settings|ajustes|configuración)(\s|$)/i.test(String(value || '').trim()))), 'el acceso a Configuración', 15000);
            settings.click();
            await until(inSettingsHome, 'Configuración');
          }
          const notificationEntry = findText(['Notifications','Notificaciones']);
          notificationEntry.click();
          await until(categoriesVisible, 'las categorías de notificaciones');
        }
      }

      const categories = [
        { name: 'Messages', labels: ['Messages','Mensajes'], toggles: [['Show notifications','Mostrar notificaciones'], ['Play sound','Reproducir sonido']] },
        { name: 'Groups', labels: ['Groups','Grupos'], toggles: [['Show notifications','Mostrar notificaciones'], ['Play sound','Reproducir sonido']] },
        { name: 'Calls', labels: ['Calls','Llamadas'], toggles: [['Show notifications for incoming calls','Mostrar notificaciones de llamadas entrantes'], ['Play sound for incoming calls','Reproducir sonido de llamadas entrantes']] }
      ];
      let saved;
      try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
      if (!enabled && !saved) return { ok: true, service: profileId, enabled, changed: [] };
      if (enabled && !saved) saved = {};
      const changed = [];
      for (const category of categories) {
        if (!enabled && !saved[category.name]) continue;
        if (!await clickText(category.labels)) throw new Error('No encontré la sección ' + category.name + '.');
        await until(() => stateOf(switchFor(category.toggles[0])) !== null, category.name);
        for (const labels of (enabled ? [...category.toggles].reverse() : category.toggles)) {
          const control = switchFor(labels);
          const state = stateOf(control);
          if (state === null) throw new Error('No pude leer “' + labels[0] + '” en ' + category.name + '.');
          if (enabled) {
            if (!(category.name in saved)) saved[category.name] = {};
            if (!(labels[0] in saved[category.name])) saved[category.name][labels[0]] = state;
            // Persist each original value before changing it. If the settings
            // UI changes midway, OFF can still restore already-touched items.
            localStorage.setItem(key, JSON.stringify(saved));
            await setSwitch(labels, false);
          } else if (saved?.[category.name] && labels[0] in saved[category.name]) {
            await setSwitch(labels, Boolean(saved[category.name][labels[0]]));
          }
        }
        await goBack();
        changed.push(category.name);
      }
      if (enabled) localStorage.setItem(key, JSON.stringify(saved));
      else localStorage.removeItem(key);
      return { ok: true, service: profileId, enabled, changed };
    } catch (error) {
      return { ok: false, service: profileId, enabled, error: error.message };
    }
  }.toString()})(${JSON.stringify(enabled)},${JSON.stringify(profileId)});`;
  try {
    const result = await webContents.executeJavaScript(script, true);
    return result || { ok: false, service: profileId, error: 'WhatsApp no devolvió confirmación.' };
  } catch (error) {
    return { ok: false, service: profileId, error: error.message };
  }
}

async function applyTelegramWorkMode(webContents, enabled) {
  try {
    const result = await webContents.executeJavaScript(`window.__msgHubNotificationAudio?.setEnabled(${JSON.stringify(enabled)})`);
    if (!result?.ok) return { ok:false, service:'telegram', error:'Telegram debe terminar de cargar para aplicar el silencio.' };
    return { ...result, service:'telegram' };
  } catch(error) { return {ok:false, service:'telegram', error:error.message}; }
}

module.exports = { applyWhatsAppWorkMode, applyTelegramWorkMode };
