const test = require('node:test');
const assert = require('node:assert/strict');
const board = require('../src/kanban-seed.json');

test('la semilla pública está vacía y no publica notas del usuario', () => {
  assert.deepEqual(board.cards, []); assert.equal(board.totalCards,0);
  assert.deepEqual(Object.keys(board.topicGroups),['Trabajo','Personal','Esports']);
});

test('todas las tarjetas importadas tienen los campos de gestión y las acciones son válidas', () => {
  for (const card of board.cards) {
    assert.ok(card.id && card.title && board.columns.includes(card.state));
    assert.ok(board.topicOrder.includes(card.topic));
    assert.ok(Array.isArray(card.actions));
    assert.equal(typeof card.blocked, 'boolean');
    assert.equal(typeof card.archived, 'boolean');
    for (const action of card.actions) {
      assert.equal(typeof action.text, 'string');
      assert.equal(typeof action.done, 'boolean');
    }
  }
});
