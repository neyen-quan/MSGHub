const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerAttachmentDrag } = require('../electron/attachment-drag.cjs');

function makeHarness(root) {
  const handlers = { on: new Map(), handle: new Map() };
  const statuses = [];
  const source = { isDestroyed: () => false, send: (_channel, message) => statuses.push(message) };
  const delivered = [];
  const ipcMain = {
    on: (channel, callback) => handlers.on.set(channel, callback),
    handle: (channel, callback) => handlers.handle.set(channel, callback)
  };
  registerAttachmentDrag({
    ipcMain,
    source: () => source,
    deliverFiles: async (target, files) => { delivered.push({ target, files }); },
    allowedPath: candidate => {
      const relative = path.relative(root, candidate);
      return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    },
    allowedTarget: contents => contents === target
  });
  const target = {};
  return { handlers, source, statuses, delivered, target };
}

test('attachment capability passes original file paths once to an allowed chat target', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msghub-attachment-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'prueba ñ.bin');
  fs.writeFileSync(filePath, Buffer.from([0, 1, 2, 127, 128, 255]));
  const { handlers, source, statuses, delivered, target } = makeHarness(root);
  const begin = handlers.on.get('begin-attachment-drag');
  const event = { sender: source, returnValue: undefined };
  begin(event, [filePath]);
  assert.ok(event.returnValue.token);

  const deliver = handlers.handle.get('deliver-attachment-drag');
  const first = await deliver({ sender: target }, event.returnValue.token);
  assert.deepEqual(first, { ok: true });
  assert.deepEqual(delivered, [{ target, files: [filePath] }]);
  assert.equal(await deliver({ sender: target }, event.returnValue.token).then(result => Boolean(result.error)), true);
  assert.ok(statuses.some(message => message.includes('vista previa')));
});

test('attachment drag rejects files outside the selected Documents folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msghub-attachment-root-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'msghub-attachment-outside-'));
  try {
    const filePath = path.join(outside, 'secreto.txt');
    fs.writeFileSync(filePath, 'no transfer');
    const { handlers, source } = makeHarness(root);
    const event = { sender: source, returnValue: undefined };
    handlers.on.get('begin-attachment-drag')(event, [filePath]);
    assert.match(event.returnValue.error, /carpeta habilitada/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
