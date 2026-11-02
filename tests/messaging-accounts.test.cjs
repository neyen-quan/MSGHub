const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_ACCOUNTS, ACCOUNT_CATALOG, loadAccounts, addAccount, serviceFor } = require('../electron/messaging-accounts.cjs');
const { applyMessagingAudioPreferences, applyMessagingAudioMode } = require('../electron/audio-mode.cjs');
test('existing six session IDs survive additions and a saved/reloaded configuration', () => {
  for (const first of ['whatsapp', 'telegram']) for (const second of ['whatsapp', 'telegram']) {
    let accounts = addAccount(loadAccounts(null), first, 'Cuenta siete');
    accounts = addAccount(accounts, second, 'Cuenta ocho');
    assert.deepEqual(loadAccounts(JSON.parse(JSON.stringify(accounts))), accounts);
    assert.deepEqual(accounts.slice(0, 6), DEFAULT_ACCOUNTS);
    assert.equal(new Set(accounts.map(a => a.id)).size, 8);
    assert.throws(() => addAccount(accounts, first), /ocho/);
    assert.equal(serviceFor('global-2::' + accounts[6].id), first);
  }
});
test('untrusted saved accounts cannot replace old profiles, duplicate a slot or add arbitrary services', () => {
  assert.deepEqual(loadAccounts([{ id: 'wa-personal', name: 'changed' }, { id: '../../other' }]), DEFAULT_ACCOUNTS);
  const loaded = loadAccounts([{ id: 'wa-extra-7' }, { id: 'telegram-extra-7' }, { id: 'telegram-extra-8' }, { id: 'wa-extra-8' }]);
  assert.equal(loaded.length, 8);
  assert.equal(serviceFor('wa-extra-9'), undefined);
  assert.throws(() => addAccount(DEFAULT_ACCOUNTS, 'other'), /Elegí/);
});
test('new independent profiles honor global and per-account audio preferences', () => {
  const views = new Map(ACCOUNT_CATALOG.map(a => ['split::' + a.id, { webContents: { isDestroyed: () => false, setAudioMuted(value) { this.muted = value; } } }]));
  applyMessagingAudioMode(views, true);
  assert.ok([...views.values()].every(v => v.webContents.muted));
  applyMessagingAudioPreferences(views, ['wa-extra-7', 'telegram-extra-8']);
  for (const [id, v] of views) assert.equal(v.webContents.muted, ['split::wa-extra-7', 'split::telegram-extra-8'].includes(id));
});
