import React, { useMemo, useState } from 'react';
import { Archive, ArrowUp, ArrowDown, Check, Circle, Clock3, Flag, ListChecks, Plus, Search, Square, Tag, X } from 'lucide-react';
import emptySeed from './kanban-seed.json';
const privateConfig = window.workhub?.privateConfig || {};
const seed = privateConfig.kanbanSeed || emptySeed;
import { GROUPS, STATES, activeCount, allActionsDone, saveTask, reorderTask, byOrder, addTopic, initializeBoard } from './kanban-rules.mjs';

const STORAGE_KEY = 'msghub-kanban-v1';
const PRIORITIES = ['Alta', 'Media', 'Baja'];
const copyCards = cards => cards.map(card => ({ ...card, actions: (card.actions || []).map(action => ({ ...action })) }));
function loadBoard() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === 1 && Array.isArray(saved.cards)) return initializeBoard({ ...seed, ...saved, cards: copyCards(saved.cards) }, privateConfig.initialTopics || []);
  } catch {}
  return initializeBoard({ ...seed, cards: copyCards(seed.cards) }, privateConfig.initialTopics || []);
}
const newId = () => `MSG-${Date.now().toString(36).toUpperCase()}`;

export default function TasksPane() {
  const [board, setBoard] = useState(loadBoard);
  const [topicFilter, setTopicFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dragId, setDragId] = useState('');
  const [manager, setManager] = useState(false);
  const [newTopic, setNewTopic] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  React.useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...board, version: 1 })); }, [board]);

  const topics = board.topicOrder || Object.keys(board.totalsByTopic || {});
  const groupedTopics = board.topicGroups || {};
  const cards = board.cards || [];
  const visibleTopics = groupFilter === 'Todos' ? topics : groupFilter === 'Sistema' ? (board.systemTopics || []) : (groupedTopics[groupFilter] || []);
  const filtered = useMemo(() => cards.filter(card => {
    if ((board.hiddenTopics || []).includes(card.topic)) return false;
    if (Boolean(card.archived) !== showArchived) return false;
    if (topicFilter && card.topic !== topicFilter) return false;
    if (!topicFilter && groupFilter !== 'Todos' && groupFilter !== 'Sistema' && !(groupedTopics[groupFilter] || []).includes(card.topic)) return false;
    if (groupFilter === 'Sistema' && !(board.systemTopics || []).includes(card.topic)) return false;
    const q = search.trim().toLocaleLowerCase('es');
    return !q || [card.id, card.title, card.description, card.topic, ...(card.actions || []).map(action => action.text)].join(' ').toLocaleLowerCase('es').includes(q);
  }), [cards, showArchived, topicFilter, groupFilter, groupedTopics, board.systemTopics, board.hiddenTopics, search]);

  function changeCards(transform) { setBoard(current => ({ ...current, cards: transform(copyCards(current.cards)) })); }
  function saveCard(card) {
    const result = saveTask(cards, card);
    if (result.error) { setError(result.error); return; }
    setError('');
    setBoard(current => ({ ...current, cards: saveTask(current.cards, card).cards }));
    setNotice(result.promoted ? `Ahora En curso: “${result.promoted.title}” (${result.promoted.topic}).` : '');
    setEditing(null);
  }
  function moveCard(id, state) {
    const card = cards.find(c => c.id === id);
    if (card) saveCard({ ...card, state, completedAt: state === 'Completado' ? card.completedAt || new Date().toISOString() : null });
  }
  function restoreCard(card) {
    if (card.archived) saveCard({ ...card, archived: false });
    else saveCard({ ...card, archived: true });
  }
  function toggleTopic(topic) {
    const hidden = board.hiddenTopics || [];
    setBoard({ ...board, hiddenTopics: hidden.includes(topic) ? hidden.filter(t => t !== topic) : [...hidden, topic] });
    if (topicFilter === topic) setTopicFilter('');
  }
  function createTopic(name, group) {
    try {
      const next = addTopic(board, name, group);
      setBoard(next); setTopicFilter(name.trim()); setGroupFilter(group); setShowArchived(false); setNewTopic(null); setError('');
    } catch (e) { setError(e.message); }
  }
  function dropOnColumn(state) { if (dragId) moveCard(dragId, state); setDragId(''); }
  function toggleAction(id, index) {
    const card = cards.find(item => item.id === id);
    if (!card) return;
    saveCard({ ...card, actions: card.actions.map((action, i) => i === index ? { ...action, done: !action.done } : action) });
  }
  const addCard = () => setEditing({ id: newId(), title: '', topic: topicFilter || visibleTopics.find(t => !(board.hiddenTopics || []).includes(t)) || '', state: 'Pendiente', priority: 'Media', date: '', description: '', completedAt: null, archived: false, order: 0, customColor: null, blocked: false, blockReason: '', actions: [] });
  const countState = state => filtered.filter(card => card.state === state).length;
  const initials = text => (text || '').slice(0, 2).toUpperCase();

  return <main className="kanban-page">
    <aside className="kanban-sidebar">
      <div className="kanban-side-title"><ListChecks size={16}/><span>Mis tareas</span><button title="Nueva tarjeta" onClick={addCard}><Plus size={15}/></button></div>
      <button className={`kanban-topic-option ${!topicFilter && groupFilter === 'Todos' ? 'selected' : ''}`} onClick={() => { setTopicFilter(''); setGroupFilter('Todos'); }}>Todas las temáticas <span>{cards.filter(c => !c.archived).length}</span></button>
      <button className="kanban-topic-option" onClick={() => setManager(true)}>⚙ Mostrar / ocultar grupos</button>
      {GROUPS.map(group => {
        const list = group === 'Sistema' ? board.systemTopics || [] : groupedTopics[group] || [];
        return <section className="kanban-topic-group" key={group}>
          <div className="kanban-group-row"><button className={`kanban-group-heading ${groupFilter === group && !topicFilter ? 'selected' : ''}`} onClick={() => { setTopicFilter(''); setGroupFilter(group); }}>{group}</button><button className="kanban-small-button" title={`Crear grupo en ${group}`} onClick={() => { setError(''); setNewTopic(group); }}><Plus size={16}/></button></div>
          {list.filter(t => !(board.hiddenTopics || []).includes(t)).map(topic => <button key={topic} className={`kanban-topic-option ${topicFilter === topic ? 'selected' : ''}`} onClick={() => { setTopicFilter(topic); setGroupFilter(group); }}><i style={{ background: board.themeColors?.[topic] || '#8b80d5' }}/><span className="kanban-topic-label">{topic}</span><span title="Tareas En curso / límite" className="kanban-topic-count">{activeCount(cards, topic)}/3</span></button>)}
        </section>;
      })}
      <button className={`kanban-topic-option kanban-archive-link ${showArchived ? 'selected' : ''}`} onClick={() => setShowArchived(value => !value)}><Archive size={13}/>{showArchived ? 'Volver al tablero' : 'Archivadas'}<span>{cards.filter(c => c.archived).length}</span></button>
    </aside>
    <section className="kanban-content">
      {error && !editing && !newTopic && <div className="kanban-notice" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}
      <header className="kanban-toolbar"><div><h1>{showArchived ? 'Tareas archivadas' : topicFilter || (groupFilter === 'Todos' ? 'Todas las tareas' : groupFilter === 'Sistema' ? 'Temáticas del sistema' : groupFilter)}</h1><p>{showArchived ? 'Tarjetas archivadas del tablero.' : 'Máximo 3 En curso por grupo. Al completar una, entra la primera Pendiente del mismo grupo.'} <span> {cards.length} tarjetas</span></p></div>
        <div className="kanban-toolbar-actions"><button className="kanban-add-button" onClick={() => { setError(''); setNewTopic(groupFilter === 'Todos' ? 'Trabajo' : groupFilter); }}><Plus size={15}/> Nuevo grupo</button><label className="kanban-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar tarea"/></label><button className="kanban-add-button" onClick={addCard}><Plus size={15}/> Nueva tarea</button></div>
      </header>
      {topicFilter && activeCount(cards, topicFilter) > 3 && <div className="kanban-notice">Este grupo conserva {activeCount(cards, topicFilter)} tareas En curso anteriores. Completá o pasá tareas a Pendiente hasta quedar por debajo de 3 para activar otra.</div>}
      {notice && <div className="kanban-promotion-notice" role="status">{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
      <div className="kanban-board" aria-label="Tablero de tareas">
        {STATES.map(state => <section className={`kanban-column ${state === 'En curso' ? 'kanban-focus-column' : state === 'Futuro' ? 'kanban-roadmap-column' : ''}`} key={state} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); dropOnColumn(state); }}>
          <header className={`kanban-column-head state-${initials(state).toLowerCase()}`}><span className="kanban-state-dot"/><h2>{state}{state === 'En curso' && <small>FOCO</small>}{state === 'Futuro' && <small>ROADMAP</small>}</h2><b>{countState(state)}</b>{!showArchived && <button title={`Crear tarjeta en ${state}`} onClick={() => setEditing({ ...loadNewForState(state), topic: topicFilter || visibleTopics.find(t => !(board.hiddenTopics || []).includes(t)) || '' })}><Plus size={14}/></button>}</header>
          <div className="kanban-card-list">{filtered.filter(card => card.state === state).sort(byOrder).map(card => {
            const actions = card.actions || [], done = actions.filter(action => action.done).length;
            return <article className={`kanban-card ${card.blocked ? 'is-blocked' : ''}`} key={card.id} draggable={!showArchived} onDragStart={event => { event.dataTransfer.setData('text/plain', card.id); event.dataTransfer.effectAllowed = 'move'; setDragId(card.id); }} onDragEnd={() => setDragId('')} onClick={() => setEditing(card)}>
              <div className="kanban-card-meta"><span className="kanban-card-id">{card.id}</span>{!showArchived && ['Pendiente','Futuro'].includes(state) && <span className="kanban-queue-controls"><button title="Subir en la cola del grupo" aria-label={`Subir ${card.title}`} onClick={event => { event.stopPropagation(); changeCards(current => reorderTask(current, card.id, -1)); }}><ArrowUp size={14}/></button><button title="Bajar en la cola del grupo" aria-label={`Bajar ${card.title}`} onClick={event => { event.stopPropagation(); changeCards(current => reorderTask(current, card.id, 1)); }}><ArrowDown size={14}/></button></span>}<button className="kanban-card-menu" title="Editar tarjeta" onClick={event => { event.stopPropagation(); setEditing(card); }}>•••</button></div>
              <h3>{card.title || '(Sin título)'}</h3>
              <div className="kanban-card-badges"><span className="kanban-topic-badge" style={{ '--topic-color': card.customColor || board.themeColors?.[card.topic] || '#8b80d5' }}><i/>{card.topic}</span>{card.priority && <span className={`priority-${card.priority.toLowerCase()}`}><Flag size={10}/>{card.priority}</span>}{card.blocked && <span className="blocked-badge">Bloqueada</span>}</div>
              {card.description && <p className="kanban-card-description">{card.description}</p>}{card.blocked && card.blockReason && <p className="kanban-card-description kanban-block-reason">Motivo: {card.blockReason}</p>}
              {actions.length > 0 && <div className="kanban-actions-progress"><div><ListChecks size={12}/><span>{done}/{actions.length}</span></div><div className="kanban-progress-track"><i style={{ width: `${done/actions.length*100}%` }}/></div>
                {actions.slice(0, 3).map((action, index) => <button key={`${card.id}-${index}`} className={`kanban-action-line ${action.done ? 'done' : ''}`} onClick={event => { event.stopPropagation(); toggleAction(card.id, index); }}><span>{action.done ? <Check size={10}/> : <Square size={10}/>}</span><span>{action.text}</span></button>)}{actions.length > 3 && <small>+{actions.length - 3} acciones</small>}
              </div>}
              <footer><span>{card.date && <><Clock3 size={11}/>{card.date}</>}</span><button title={card.archived ? 'Restaurar tarjeta' : 'Archivar tarjeta'} onClick={event => { event.stopPropagation(); restoreCard(card); }}>{card.archived ? 'Restaurar' : <Archive size={12}/>}</button></footer>
            </article>;
          })}{filtered.filter(card => card.state === state).length === 0 && <div className="kanban-column-empty">Arrastrá una tarjeta acá o creá una nueva.</div>}</div>
        </section>)}
      </div>
    </section>
    {manager && <div className="kanban-modal-backdrop"><section className="kanban-editor" role="dialog" aria-modal="true" aria-label="Mostrar u ocultar grupos"><header><h2>Mostrar / ocultar grupos</h2><button onClick={() => setManager(false)} aria-label="Cerrar"><X/></button></header><p>Destildá para ocultar el grupo y sus tarjetas. Se conservan todos los datos.</p><div className="kanban-manager-actions"><button onClick={() => { setBoard({ ...board, hiddenTopics: [] }); }}>Mostrar todos</button><button onClick={() => { setBoard({ ...board, hiddenTopics: [...topics] }); setTopicFilter(''); }}>Ocultar todos</button></div>{GROUPS.map(group => <section key={group}><h3>{group}</h3>{(group === 'Sistema' ? board.systemTopics || [] : groupedTopics[group] || []).map(topic => <label className="kanban-visibility" key={topic}><input type="checkbox" checked={!(board.hiddenTopics || []).includes(topic)} onChange={() => toggleTopic(topic)}/>{topic}</label>)}</section>)}</section></div>}
    {newTopic && <TopicEditor group={newTopic} error={error} onCancel={() => { setNewTopic(null); setError(''); }} onSave={createTopic}/>}
    {editing && <CardEditor card={editing} topics={topics.filter(topic => !(board.hiddenTopics || []).includes(topic) || topic === editing.topic)} error={error} cards={cards} groups={groupedTopics} colors={board.themeColors || {}} onCancel={() => { setEditing(null); setError(''); }} onSave={saveCard}/>}
  </main>;
}

function loadNewForState(state) { return { id: newId(), title: '', topic: '', state, priority: 'Media', date: '', description: '', completedAt: null, archived: false, order: 0, customColor: null, blocked: false, blockReason: '', actions: [] }; }

function CardEditor({ card, topics, groups, colors, error, cards, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...card, actions: (card.actions || []).map(action => ({ ...action })) }));
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const changeAction = (index, key, value) => setDraft(current => ({ ...current, actions: current.actions.map((action, i) => i === index ? { ...action, [key]: value } : action) }));
  const addAction = () => update('actions', [...draft.actions, { text: '', done: false }]);
  return <div className="kanban-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}><form className="kanban-editor" onSubmit={event => { event.preventDefault(); if (!draft.title.trim()) return; onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim(), actions: draft.actions.map(action => ({ ...action, text: action.text.trim() })).filter(action => action.text), completedAt: draft.state === 'Completado' ? draft.completedAt || new Date().toISOString() : null }); }}>
    <header><div><span>{card.title ? card.id : 'NUEVA TARJETA'}</span><h2>{card.title || 'Crear tarea'}</h2></div><button type="button" onClick={onCancel} aria-label="Cerrar"><X size={17}/></button></header>
    {error && <div className="kanban-notice" role="alert">{error}</div>}
    <p className="kanban-limit-help">{activeCount(cards, draft.topic)}/3 En curso en este grupo. Pendiente es la cola próxima; Futuro es el roadmap.</p>
    <label className="kanban-field wide">Título<input autoFocus maxLength={160} value={draft.title} onChange={event => update('title', event.target.value)} required/></label>
    <div className="kanban-field-row"><label className="kanban-field">Temática<select required value={draft.topic} onChange={event => update('topic', event.target.value)}><option value="" disabled>Elegí un grupo</option>{topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}</select></label><label className="kanban-field">Estado<select value={allActionsDone(draft) ? 'Completado' : draft.state} onChange={event => update('state', event.target.value)}>{STATES.map(state => <option key={state}>{state}</option>)}</select></label></div>
    <div className="kanban-field-row"><label className="kanban-field">Prioridad<select value={draft.priority || 'Media'} onChange={event => update('priority', event.target.value)}>{PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select></label><label className="kanban-field">Fecha objetivo<input type="date" value={draft.date || ''} onChange={event => update('date', event.target.value)}/></label></div>
    <label className="kanban-field wide">Descripción<textarea rows="3" value={draft.description || ''} onChange={event => update('description', event.target.value)} /></label>
    <section className="kanban-editor-actions"><header><strong>Acciones / checklist</strong><button type="button" onClick={addAction}><Plus size={13}/> Agregar</button></header>{draft.actions.map((action, index) => <div className="kanban-editor-action" key={index}><input type="checkbox" checked={Boolean(action.done)} onChange={event => changeAction(index, 'done', event.target.checked)} aria-label="Acción completada"/><input value={action.text} onChange={event => changeAction(index, 'text', event.target.value)} placeholder="Descripción de la acción"/><button type="button" aria-label="Eliminar acción" onClick={() => update('actions', draft.actions.filter((_, i) => i !== index))}><X size={13}/></button></div>)}</section>
    {allActionsDone(draft) && <p className="kanban-checklist-complete" role="status">Todas las acciones están listas. Al guardar, la tarjeta pasa a Completado; si estaba En curso, entra la siguiente pendiente del grupo.</p>}
    <label className="kanban-block-toggle"><input type="checkbox" checked={Boolean(draft.blocked)} onChange={event => update('blocked', event.target.checked)}/><span>Bloqueada</span></label>{draft.blocked && <label className="kanban-field wide">Motivo del bloqueo<input value={draft.blockReason || ''} onChange={event => update('blockReason', event.target.value)}/></label>}
    <footer><button type="button" onClick={onCancel}>Cancelar</button><button type="submit" className="kanban-save-button">Guardar cambios</button></footer>
  </form></div>;
}

function TopicEditor({ group, error, onCancel, onSave }) {
  const [name, setName] = useState('');
  const [section, setSection] = useState(group);
  return <div className="kanban-modal-backdrop"><form className="kanban-editor" onSubmit={e => { e.preventDefault(); onSave(name, section); }} role="dialog" aria-modal="true" aria-label="Crear grupo">
    <header><h2>Nuevo grupo de tareas</h2><button type="button" onClick={onCancel} aria-label="Cerrar"><X/></button></header>
    {error && <div role="alert" className="kanban-notice">{error}</div>}
    <label className="kanban-field wide">Sección<select value={section} onChange={e => setSection(e.target.value)}>{GROUPS.map(g => <option key={g}>{g}</option>)}</select></label>
    <label className="kanban-field wide">Nombre del grupo<input autoFocus required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Ej.: Rina Hollis"/></label>
    <p>Después, usá Nueva tarea para agregar tarjetas con fecha dentro del grupo.</p>
    <footer><button type="button" onClick={onCancel}>Cancelar</button><button className="kanban-save-button">Crear grupo</button></footer>
  </form></div>;
}
