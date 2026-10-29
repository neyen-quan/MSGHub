const { test } = require('node:test');
const assert = require('node:assert/strict');
const { injectFilesIntoChat, supports } = require('../electron/chat-file-input.cjs');

function makeDebugger(inputs) {
  let attached = false;
  const calls = [];
  const debug = {
    isAttached: () => attached,
    attach: version => { calls.push(['attach', version]); attached = true; },
    detach: () => { calls.push(['detach']); attached = false; },
    sendCommand: async (method, params) => {
      calls.push([method, params]);
      if (method === 'DOM.getDocument') return { root: { nodeId: 1 } };
      if (method === 'DOM.querySelectorAll') return { nodeIds: inputs.map(input => input.nodeId) };
      if (method === 'DOM.describeNode') return { node: { attributes: inputs.find(input => input.nodeId === params.nodeId).attributes } };
      return {};
    }
  };
  return { debug, calls, isAttached: () => attached };
}

test('file injection chooses the matching WhatsApp file input and sets actual paths', async () => {
  const { debug, calls, isAttached } = makeDebugger([
    { nodeId: 2, attributes: ['type', 'file', 'accept', 'image/*,video/*'] },
    { nodeId: 3, attributes: ['type', 'file', 'accept', 'application/pdf', 'multiple', ''] },
    { nodeId: 4, attributes: ['type', 'file', 'accept', '*'] }
  ]);
  const files = ['C:\\Users\\Public\\Documents\\brief.pdf'];
  const result = await injectFilesIntoChat(debug, files);
  assert.deepEqual(result, { ok: true, nodeId: 3 });
  assert.ok(calls.some(([method, params]) => method === 'DOM.setFileInputFiles' && params.nodeId === 3 && params.files === files));
  assert.equal(isAttached(), false);
});

test('file injection preserves a debugger session owned by another feature', async () => {
  const { debug, calls, isAttached } = makeDebugger([{ nodeId: 5, attributes: ['type', 'file'] }]);
  debug.attach('1.3');
  calls.length = 0;
  await injectFilesIntoChat(debug, ['C:\\Documents\\nota.txt']);
  assert.equal(isAttached(), true);
  assert.equal(calls.some(([method]) => method === 'detach'), false);
});

test('file type matching recognizes document and media MIME filters', () => {
  assert.equal(supports({ accept: 'application/pdf' }, 'informe.PDF'), true);
  assert.equal(supports({ accept: 'image/*' }, 'foto.png'), true);
  assert.equal(supports({ accept: 'image/*' }, 'informe.pdf'), false);
});
