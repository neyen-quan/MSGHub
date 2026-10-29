const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('todos los archivos Electron compilan sintácticamente antes del empaquetado', () => {
  const root = path.join(__dirname, '..', 'electron');
  for (const name of fs.readdirSync(root).filter(file => file.endsWith('.cjs'))) {
    const file = path.join(root, name);
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${name}: ${result.stderr || result.stdout}`);
  }
});
