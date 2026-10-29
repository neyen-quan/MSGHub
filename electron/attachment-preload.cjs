const { ipcRenderer } = require('electron');
const markerType = 'application/x-workhub-attachment';
let hint = null;
let depth = 0;

function clearHint() { hint?.remove(); hint = null; depth = 0; }
function showHint(text) {
  if (!hint) {
    hint = document.createElement('div');
    hint.style.cssText = 'position:fixed;inset:14px;z-index:2147483647;pointer-events:none;border:3px dashed #a899ff;border-radius:18px;background:rgba(20,17,35,.82);color:white;display:flex;align-items:center;justify-content:center;font:600 20px system-ui;text-align:center;padding:30px;';
    document.documentElement.appendChild(hint);
  }
  hint.textContent = text;
}
function ours(event) {
  return event.isTrusted && [...(event.dataTransfer?.types || [])].includes(markerType);
}
function mime(name) {
  const ext = name.split('.').pop().toLowerCase();
  return ({ pdf:'application/pdf', txt:'text/plain', md:'text/markdown', csv:'text/csv', json:'application/json', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', mp4:'video/mp4', zip:'application/zip' })[ext] || 'application/octet-stream';
}
for (const type of ['dragenter', 'dragover', 'dragleave']) {
  window.addEventListener(type, event => {
    if (!ours(event)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (type === 'dragleave') {
      if (--depth <= 0) clearHint();
    } else {
      if (type === 'dragenter') depth++;
      event.dataTransfer.dropEffect = 'copy';
      showHint('Soltá para adjuntar el archivo');
    }
  }, true);
}
window.addEventListener('drop', async event => {
  if (!ours(event)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const token = event.dataTransfer.getData(markerType);
  showHint('Adjuntando archivo…');
  try {
    const result = await ipcRenderer.invoke('deliver-attachment-drag', token);
    if (result?.error || !result?.ok) throw new Error(result?.error || 'WhatsApp no aceptó el archivo.');
    clearHint();
    showHint('Adjunto preparado. Revisá la vista previa del chat.');
    setTimeout(clearHint, 3500);
  } catch (error) {
    showHint(error.message || 'No se pudo adjuntar el archivo.');
    setTimeout(clearHint, 4500);
  }
}, true);
window.addEventListener('dragend', clearHint, true);
window.addEventListener('pagehide', clearHint);
