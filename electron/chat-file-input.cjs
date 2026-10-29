const path = require('node:path');

const attachmentMime = Object.freeze({
  pdf:'application/pdf', txt:'text/plain', md:'text/markdown', csv:'text/csv', json:'application/json',
  doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml',
  mp4:'video/mp4', zip:'application/zip'
});

function supports(candidate, file) {
  if (!candidate.accept || candidate.accept === '*' || candidate.accept === '*/*') return true;
  const ext = path.extname(file).toLowerCase();
  const mime = attachmentMime[ext.slice(1)] || 'application/octet-stream';
  return candidate.accept.split(',').map(value => value.trim()).some(rule =>
    rule === ext || rule === mime || (rule.endsWith('/*') && mime.startsWith(rule.slice(0, -1)))
  );
}

async function injectFilesIntoChat(debuggerApi, files) {
  const wasAttached = debuggerApi.isAttached();
  try {
    if (!wasAttached) debuggerApi.attach('1.3');
    await debuggerApi.sendCommand('DOM.enable');
    const { root } = await debuggerApi.sendCommand('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeIds } = await debuggerApi.sendCommand('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'input[type="file"]' });
    const candidates = [];
    for (const nodeId of nodeIds || []) {
      const { node } = await debuggerApi.sendCommand('DOM.describeNode', { nodeId });
      const attributes = Object.fromEntries((node.attributes || []).reduce((pairs, value, index, all) => {
        if (index % 2 === 0) pairs.push([value, all[index + 1] || '']);
        return pairs;
      }, []));
      candidates.push({ nodeId, accept: (attributes.accept || '').toLowerCase(), multiple: Object.hasOwn(attributes, 'multiple') });
    }
    if (!candidates.length) throw new Error('WhatsApp no mostró un selector de archivos. Abrí un chat y volvé a arrastrar.');
    const compatible = candidates.filter(candidate => files.every(file => supports(candidate, file)));
    const choices = compatible.length ? compatible : candidates;
    const selected = choices.sort((left, right) => {
      const leftScore = (left.multiple ? 2 : 0) + (left.accept ? 1 : 0);
      const rightScore = (right.multiple ? 2 : 0) + (right.accept ? 1 : 0);
      return rightScore - leftScore;
    })[0];
    await debuggerApi.sendCommand('DOM.setFileInputFiles', { nodeId: selected.nodeId, files });
    return { ok: true, nodeId: selected.nodeId };
  } catch (error) {
    if (/another debugger|another session|already attached/i.test(String(error.message))) {
      throw new Error('No se pudo acceder al control de adjuntos de WhatsApp porque DevTools está ocupado. Cerrá DevTools y volvé a intentar.');
    }
    throw error;
  } finally {
    if (!wasAttached && debuggerApi.isAttached()) debuggerApi.detach();
  }
}

module.exports = { injectFilesIntoChat, supports };
