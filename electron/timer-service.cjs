const fs = require('node:fs');
const path = require('node:path');

function today(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const LEISURE_CATEGORIES = ['Descanso', 'Desayunar', 'Almorzar', 'Cenar', 'Merendar', 'Whatsapp', 'Jugar', 'GYM', 'Otro'];
const HISTORICAL_CATEGORY = 'Sin categoría (histórico)';
const UNCLASSIFIED_CATEGORY = 'Pendiente de clasificar';
const emptyDay = () => ({ workMs: 0, leisureMs: 0, pauseMs: 0, leisureByCategory: {}, leisureDetails: {}, pauseByCategory: {}, pauseDetails: {} });
const validState = value => Boolean(value && [1, 2, 3, 4, 5].includes(value.version) && value.days && typeof value.days === 'object' && !Array.isArray(value.days));

function readStateFile(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const value = JSON.parse(raw);
    if (!validState(value)) return null;
    return { value, raw, modifiedAt: fs.statSync(file).mtimeMs };
  } catch { return null; }
}

function atomicWrite(file, contents) {
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'w');
    fs.writeFileSync(descriptor, contents, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor); descriptor = undefined;
    fs.renameSync(temporary, file);
    try {
      const directory = fs.openSync(path.dirname(file), 'r');
      try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    } catch {}
  } finally {
    if (descriptor !== undefined) try { fs.closeSync(descriptor); } catch {}
    try { fs.rmSync(temporary, { force: true }); } catch {}
  }
}

function archiveDamagedFile(file, timestamp) {
  try {
    if (!fs.existsSync(file)) return;
    let archived = `${file}.corrupt-${timestamp}`;
    let suffix = 1;
    while (fs.existsSync(archived)) archived = `${file}.corrupt-${timestamp}-${suffix++}`;
    fs.renameSync(file, archived);
  } catch {}
}

function createTimerService({ filePath, onAlarm = () => {}, now = Date.now, intervalMs = 1000 } = {}) {
  const defaults = () => ({ version: 5, settings: { workMinutes: 55, breakMinutes: 5, autoPauseEnabled: true }, days: {}, phase: null, pendingPauses: [], status: 'idle', date: today(now()) });
  let state = defaults(), storageNotice = '', monitorStatus = { available: false };
  const listeners = new Set();
  const merge = (a = {}, b = {}) => {
    const result = { ...a };
    for (const [key, value] of Object.entries(b)) result[key] = (Number(result[key]) || 0) + (Number(value) || 0);
    return result;
  };
  function normalizeDay(value) {
    const day = { ...emptyDay(), ...value };
    let pauses = { ...(value.pauseByCategory || {}) }, leisure = { ...(value.leisureByCategory || {}) };
    if (day.pauseMs > 0 && !Object.keys(pauses).length) pauses[HISTORICAL_CATEGORY] = day.pauseMs;
    if (day.leisureMs > 0 && !Object.keys(leisure).length) leisure[HISTORICAL_CATEGORY] = day.leisureMs;
    return { ...day, pauseMs: (Number(day.pauseMs) || 0) + (Number(day.leisureMs) || 0), leisureMs: 0,
      pauseByCategory: merge(pauses, leisure), pauseDetails: merge(value.pauseDetails, value.leisureDetails), leisureByCategory: {}, leisureDetails: {} };
  }
  function normalizePhase(phase) {
    if (!phase) return null;
    if (!['pause', 'leisure'].includes(phase.kind)) return { ...phase };
    const nested = phase.resumePhase?.kind === 'leisure' ? phase.resumePhase : null;
    return { ...phase, kind: 'pause', targetMs: state.settings.breakMinutes * 60000,
      elapsedMs: (Number(phase.elapsedMs) || 0) + (Number(nested?.elapsedMs) || 0),
      segments: [...(nested?.segments || []), ...(phase.segments || [])],
      resumePhase: nested ? null : phase.resumePhase };
  }
  function addInterval(days, kind, start, end, category = UNCLASSIFIED_CATEGORY) {
    let cursor = start;
    while (cursor < end) {
      const d = new Date(cursor);
      const segmentEnd = Math.min(end, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime());
      const day = days[today(cursor)] ||= emptyDay(), delta = segmentEnd - cursor;
      if (kind === 'work') day.workMs += delta;
      else { day.pauseMs += delta; day.pauseByCategory[category] = (day.pauseByCategory[category] || 0) + delta; }
      cursor = segmentEnd;
    }
  }
  function assignPause(phase, category, detail = '', destination = 'pause') {
    for (const segment of phase.segments || []) {
      let cursor = segment.start;
      while (cursor < segment.end) {
        const d = new Date(cursor), end = Math.min(segment.end, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime());
        const delta = end - cursor, day = state.days[today(cursor)];
        day.pauseByCategory[UNCLASSIFIED_CATEGORY] = Math.max(0, (day.pauseByCategory[UNCLASSIFIED_CATEGORY] || 0) - delta);
        if (!day.pauseByCategory[UNCLASSIFIED_CATEGORY]) delete day.pauseByCategory[UNCLASSIFIED_CATEGORY];
        if (destination === 'work') { day.pauseMs = Math.max(0, day.pauseMs - delta); day.workMs += delta; }
        else {
          day.pauseByCategory[category] = (day.pauseByCategory[category] || 0) + delta;
          if (category === 'Otro' && detail) day.pauseDetails[detail] = (day.pauseDetails[detail] || 0) + delta;
        }
        cursor = end;
      }
    }
  }
  if (filePath) {
    const mainFile = readStateFile(filePath), backup = readStateFile(`${filePath}.bak`), loadedFile = mainFile || backup;
    if (!mainFile && backup) {
      archiveDamagedFile(filePath, now());
      storageNotice = 'El reloj detectó un archivo incompleto y recuperó el historial desde su copia de seguridad.';
    } else if (!mainFile && fs.existsSync(filePath)) {
      archiveDamagedFile(filePath, now());
      storageNotice = 'El archivo del reloj estaba dañado. Se conservó una copia para intentar recuperarla; este archivo nuevo empieza vacío.';
    }
    if (loadedFile) {
      const loaded = loadedFile.value;
      if (loaded.version < 5) {
        try { if (!fs.existsSync(`${filePath}.pre-v5.json`)) atomicWrite(`${filePath}.pre-v5.json`, loadedFile.raw); } catch {}
      }
      state = { ...defaults(), ...loaded, version: 5, settings: { ...defaults().settings, ...loaded.settings }, days: {} };
      for (const [key, value] of Object.entries(loaded.days)) state.days[key] = normalizeDay(value);
      state.pendingPauses = (loaded.pendingPauses || []).map(normalizePhase);
      state.phase = normalizePhase(loaded.phase);
      if (state.phase?.startedAt) {
        const start = state.phase.startedAt;
        const end = Math.min(now(), Math.max(start, Number(loaded.savedAt) || loadedFile.modifiedAt || start));
        addInterval(state.days, state.phase.kind, start, end);
        if (state.phase.kind === 'pause') state.phase.segments.push({ start, end });
        state.phase.elapsedMs = (Number(state.phase.elapsedMs) || 0) + Math.max(0, end - start);
        state.phase.startedAt = null;
        if (!storageNotice) storageNotice = 'Se recuperó la sesión hasta el último guardado. El tiempo con la PC apagada no se contabilizó.';
      }
      // Preserve unfinished breaks before opening a fresh work cycle. Closed time never enters their segments.
      if (state.phase?.kind === 'pause') {
        if (state.phase.elapsedMs <= state.phase.targetMs) assignPause(state.phase, 'Descanso');
        else state.pendingPauses.push({ ...state.phase, startedAt: null, historical: true, reviewRequested: true });
      }
    }
  }
  function reviewPause() {
    if (state.phase?.kind === 'pause' && state.phase.reviewRequested) return state.phase;
    return state.pendingPauses.find(p => p.reviewRequested) || null;
  }
  function snapshot() {
    const days = Object.fromEntries(Object.entries(state.days).map(([key, value]) => [key, { ...value, pauseByCategory: { ...value.pauseByCategory }, pauseDetails: { ...value.pauseDetails } }]));
    const phase = state.phase ? { ...state.phase, elapsedMs: (state.phase.elapsedMs || 0) + (state.phase.startedAt ? Math.max(0, now() - state.phase.startedAt) : 0) } : null;
    if (state.phase?.startedAt) addInterval(days, state.phase.kind, state.phase.startedAt, now(), 'En curso');
    return { ...state, days, phase, reviewPause: reviewPause(), storageNotice, monitorStatus, today: today(now()), currentDay: { ...emptyDay(), ...(days[today(now())] || {}) } };
  }
  function save() {
    if (!filePath) return;
    const previous = state.savedAt;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const current = readStateFile(filePath);
      if (current) atomicWrite(`${filePath}.bak`, current.raw);
      state.savedAt = now();
      atomicWrite(filePath, JSON.stringify(state, null, 2));
    } catch (error) {
      state.savedAt = previous;
      storageNotice = 'No se pudo guardar el reloj. El último archivo válido se conserva para recuperación.';
      try { console.error('[MSGHub timer] No se pudo guardar el historial:', error); } catch {}
    }
  }
  function emit() { save(); const value = snapshot(); for (const listener of listeners) listener(value); }
  function settle() {
    if (!state.phase?.startedAt) return;
    const start = state.phase.startedAt, end = now();
    addInterval(state.days, state.phase.kind, start, end);
    if (state.phase.kind === 'pause') state.phase.segments.push({ start, end });
    state.phase.elapsedMs += Math.max(0, end - start);
    state.phase.startedAt = end;
  }
  function startWork() {
    state.phase = { kind: 'work', startedAt: now(), elapsedMs: 0, targetMs: state.settings.workMinutes * 60000, alerted: false };
    state.date = today(now()); state.status = 'running'; emit();
  }
  function beginPause(automatic = false) {
    if (state.phase?.kind !== 'work' || !state.phase.startedAt) return;
    settle();
    state.phase = { kind: 'pause', elapsedMs: 0, startedAt: now(), targetMs: state.settings.breakMinutes * 60000,
      alerted: false, resumePhase: { ...state.phase, startedAt: null }, segments: [], automatic, autoSince: automatic ? now() : null };
    state.status = 'pause-running'; emit();
  }
  function requestPauseReview(finishAfter = false) {
    if (state.phase?.kind !== 'pause') {
      if (state.pendingPauses.length) { state.pendingPauses[0].reviewRequested = true; emit(); }
      return;
    }
    settle(); state.phase.startedAt = null;
    if (state.phase.elapsedMs <= state.phase.targetMs) {
      assignPause(state.phase, 'Descanso');
      if (finishAfter) { state.phase = null; state.status = 'finished'; emit(); }
      else startWork();
      return;
    }
    state.phase.reviewRequested = true; state.phase.returnNotified = true; state.phase.finishAfter = finishAfter;
    state.status = 'classifying-pause'; emit();
  }
  function classifyPause(payload = {}) {
    const phase = reviewPause();
    if (!phase) throw new Error('No hay una pausa pendiente.');
    // Old integrations may send "leisure"; it now maps to the same pause total.
    const destination = phase.automatic && payload.destination === 'work' ? 'work' : 'pause';
    const category = String(payload.category || ''), detail = String(payload.detail || '').trim();
    if (destination !== 'work' && !LEISURE_CATEGORIES.includes(category)) throw new Error('Elegí una categoría válida');
    if (destination !== 'work' && category === 'Otro' && !detail) throw new Error('Especificá qué hiciste en “Otro”');
    assignPause(phase, category, detail, destination);
    if (phase !== state.phase) {
      state.pendingPauses = state.pendingPauses.filter(p => p !== phase);
      emit(); return;
    }
    if (phase.finishAfter) { state.phase = null; state.status = 'finished'; emit(); return; }
    if (destination === 'work' && phase.resumePhase?.kind === 'work') {
      state.phase = { ...phase.resumePhase, elapsedMs: phase.resumePhase.elapsedMs + phase.elapsedMs, startedAt: now() };
      state.status = state.phase.alerted ? 'work-due' : 'running'; emit();
    } else startWork();
  }
  function scaledDistribution(source, target) {
    const entries = Object.entries(source || {}).filter(([, value]) => Number(value) > 0);
    if (!entries.length) return target ? { [HISTORICAL_CATEGORY]: target } : {};
    const total = entries.reduce((sum, [, value]) => sum + Number(value), 0), result = {};
    let assigned = 0;
    entries.forEach(([key, value], index) => { const amount = index === entries.length - 1 ? target - assigned : Math.floor(target * Number(value) / total); result[key] = amount; assigned += amount; });
    return result;
  }
  function command(action, payload = {}) {
    if (state.phase?.kind === 'pause' && !['resume', 'return-work', 'finish', 'review-pause', 'classify-pause', 'categorize-return-work', 'cancel-pause-review', 'cancel-leisure-category', 'settings'].includes(action)) throw new Error('Clasificá primero la pausa pendiente.');
    if (action === 'start') { if (!state.phase) startWork(); }
    else if (['pause', 'start-break'].includes(action)) beginPause();
    else if (action === 'auto-pause') beginPause(true);
    else if (['resume', 'return-work', 'review-pause'].includes(action)) requestPauseReview();
    else if (['classify-pause', 'categorize-return-work'].includes(action)) classifyPause(payload);
    else if (['cancel-pause-review', 'cancel-leisure-category'].includes(action)) {
      if (state.phase?.kind === 'pause' && state.phase.reviewRequested) {
        state.phase.reviewRequested = false; state.phase.startedAt = now(); state.status = 'pause-running'; emit();
      } else { const pending = reviewPause(); if (pending) { pending.reviewRequested = false; emit(); } }
    }
    else if (action === 'finish') {
      if (state.phase?.kind === 'pause') requestPauseReview(true);
      else { settle(); state.phase = null; state.status = 'finished'; emit(); }
    }
    else if (action === 'continue') emit();
    else if (action === 'settings') {
      state.settings = { ...state.settings,
        workMinutes: Math.min(240, Math.max(1, Math.round(Number(payload.workMinutes) || 55))),
        breakMinutes: Math.min(60, Math.max(1, Math.round(Number(payload.breakMinutes) || 5))),
        autoPauseEnabled: typeof payload.autoPauseEnabled === 'boolean' ? payload.autoPauseEnabled : state.settings.autoPauseEnabled };
      emit();
    } else if (action === 'adjust-day') {
      const key = String(payload.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Fecha inválida');
      const day = state.days[key] || emptyDay();
      const pauseMs = Math.max(0, Math.round(Number(payload.pauseMs) || 0)) + Math.max(0, Math.round(Number(payload.leisureMs) || 0));
      const pauseByCategory = scaledDistribution(day.pauseByCategory, pauseMs);
      state.days[key] = { ...day, workMs: Math.max(0, Math.round(Number(payload.workMs) || 0)), pauseMs, leisureMs: 0,
        pauseByCategory, pauseDetails: scaledDistribution(day.pauseDetails, pauseByCategory.Otro || 0), leisureByCategory: {}, leisureDetails: {} };
      emit();
    } else throw new Error('Acción de temporizador desconocida');
    return snapshot();
  }
  // One start per Electron process, independent of the selected tab or mounted TimerPane.
  startWork();
  let closed = false;
  const timer = setInterval(() => {
    const phase = state.phase;
    if (!phase?.startedAt) return;
    const elapsed = phase.elapsedMs + Math.max(0, now() - phase.startedAt);
    if (phase.targetMs && elapsed >= phase.targetMs && !phase.alerted) {
      phase.alerted = true;
      if (phase.kind === 'work') state.status = 'work-due';
      try { onAlarm(phase.kind, snapshot()); } catch {}
    }
    emit();
  }, intervalMs);
  timer.unref?.();
  return {
    getState: snapshot, command,
    setMonitorStatus(value) { monitorStatus = value; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    shutdown() { if (closed) return; closed = true; clearInterval(timer); settle(); if (state.phase) state.phase.startedAt = null; save(); }
  };
}
module.exports = { createTimerService, today, LEISURE_CATEGORIES, HISTORICAL_CATEGORY };
