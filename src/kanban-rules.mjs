export const GROUPS = ['Trabajo', 'Personal', 'Esports', 'Sistema'];
export const STATES = ['Pendiente', 'En curso', 'Completado', 'Futuro'];
export const isActive = card => !card.archived && card.state === 'En curso';
export const activeCount = (cards, topic) => cards.filter(c => c.topic === topic && isActive(c)).length;
export function limitError(cards, card) {
  const old = cards.find(c => c.id === card.id);
  if (!isActive(card) || (old && isActive(old) && old.topic === card.topic)) return '';
  return activeCount(cards.filter(c => c.id !== card.id), card.topic) >= 3
    ? `“${card.topic}” ya tiene 3 tareas En curso. Completá una o devolvela a Pendiente para liberar un lugar. Podés crear más tareas en Pendiente o Futuro.` : '';
}
export const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0);
export function allActionsDone(card) {
  const actions = (card.actions || []).filter(action => String(action.text || '').trim());
  return actions.length > 0 && actions.every(action => action.done === true);
}
export function saveTask(cards, card, timestamp = new Date().toISOString()) {
  if (!card.archived && allActionsDone(card)) card = { ...card, state: 'Completado' };
  const error = limitError(cards, card);
  if (error) return { cards, error, promoted: null };
  const old = cards.find(c => c.id === card.id);
  const order = old && old.state === card.state ? old.order : Math.max(0, ...cards.filter(c => c.state === card.state).map(c => Number(c.order) || 0)) + 1;
  const updated = { ...old, ...card, order, completedAt: card.state === 'Completado' ? card.completedAt || timestamp : null };
  let next = old ? cards.map(c => c.id === card.id ? updated : c) : [...cards, updated];
  let promoted = null;
  // Completion releases one slot in the original group; edits, archives and imports never pull from the queue.
  if (old && isActive(old) && updated.state === 'Completado' && !updated.archived && activeCount(next, old.topic) < 3) {
    const pending = next.filter(c => c.topic === old.topic && !c.archived && c.state === 'Pendiente').sort(byOrder)[0];
    if (pending) {
      promoted = { ...pending, state: 'En curso', completedAt: null,
        order: Math.max(0, ...next.filter(c => c.state === 'En curso').map(c => Number(c.order) || 0)) + 1 };
      next = next.map(c => c.id === pending.id ? promoted : c);
    }
  }
  return { cards: next, error: '', promoted };
}
export function reorderTask(cards, id, direction) {
  const card = cards.find(c => c.id === id);
  if (!card || card.archived) return cards;
  const queue = cards.filter(c => !c.archived && c.topic === card.topic && c.state === card.state).sort(byOrder);
  const index = queue.findIndex(c => c.id === id), target = index + direction;
  if (![-1, 1].includes(direction) || target < 0 || target >= queue.length) return cards;
  [queue[index], queue[target]] = [queue[target], queue[index]];
  const ranks = new Map(queue.map((c, i) => [c.id, i + 1]));
  return cards.map(c => ranks.has(c.id) ? { ...c, order: ranks.get(c.id) } : c);
}
export function addTopic(board, name, group) {
  const topic = name.trim();
  if (!topic) throw new Error('Escribí el nombre del grupo.');
  if (!GROUPS.includes(group)) throw new Error('Elegí una sección válida.');
  if ((board.topicOrder || []).some(t => t.toLocaleLowerCase('es') === topic.toLocaleLowerCase('es'))) throw new Error('Ya existe un grupo con ese nombre.');
  return { ...board, topicOrder: [...(board.topicOrder || []), topic],
    topicGroups: group === 'Sistema' ? board.topicGroups : { ...board.topicGroups, [group]: [...(board.topicGroups?.[group] || []), topic] },
    systemTopics: group === 'Sistema' ? [...(board.systemTopics || []), topic] : board.systemTopics,
    themeColors: { ...board.themeColors, [topic]: '#a18be8' } };
}
export function initializeBoard(board, initialTopics = []) {
  let next = { ...board, hiddenTopics: board.hiddenTopics || [] };
  if (!next.privateTopicsInitialized) {
    for (const item of initialTopics) if (!(next.topicOrder || []).includes(item.name)) next = addTopic(next,item.name,item.group);
    next.privateTopicsInitialized = true;
  }
  return next;
}
