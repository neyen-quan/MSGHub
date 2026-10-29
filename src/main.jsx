import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MessageCircle, Send, Mail, FolderOpen, Sparkles, ChevronDown, ExternalLink, PanelsTopLeft, Plus, Search, ArrowLeft, File, Folder, Image, FileText, Table2, Film, RefreshCw, HardDrive, ShieldCheck, LayoutGrid, Sun, Moon, Facebook, Linkedin, CalendarDays, FolderPlus, Pencil, Trash2, Columns2, Copy, Scissors, ClipboardPaste, Smartphone, AlarmClock, ListChecks, Volume2, VolumeX } from 'lucide-react';
import TimerPane, { TimerAlarmOverlay } from './TimerPane.jsx';
import TasksPane from './TasksPane.jsx';
import './style.css';

const LOCAL_CONFIG = window.workhub?.privateConfig || {};
const EMAILS = [
  { id: 'gmail-laacade', email: LOCAL_CONFIG.emails?.['gmail-laacade'] || '', short: LOCAL_CONFIG.labels?.['gmail-laacade'] || 'Correo 1', color: '#4389d1' },
  { id: 'gmail-neyen', email: LOCAL_CONFIG.emails?.['gmail-neyen'] || '', short: 'Personal', color: '#d75f4a' },
  { id: 'gmail-hincharc', email: LOCAL_CONFIG.emails?.['gmail-hincharc'] || '', short: LOCAL_CONFIG.labels?.['gmail-hincharc'] || 'Correo 3', color: '#22a889' },
  { id: 'gmail-quan', email: LOCAL_CONFIG.emails?.['gmail-quan'] || '', short: LOCAL_CONFIG.labels?.['gmail-quan'] || 'Correo 4', color: '#8b72dc' },
  { id: 'gmail-deva', email: LOCAL_CONFIG.emails?.['gmail-deva'] || '', short: LOCAL_CONFIG.labels?.['gmail-deva'] || 'Correo 5', color: '#d29b46' },
  { id: 'gmail-alterframe', email: LOCAL_CONFIG.emails?.['gmail-alterframe'] || '', short: LOCAL_CONFIG.labels?.['gmail-alterframe'] || 'Correo 6', color: '#2c9dba' }
];
const AI_APPS = [
  { id: 'gpt-personal', name: 'GPT personal', short: 'GPT personal', sub: 'Cuenta guardada en este equipo', icon: Sparkles },
  { id: 'gpt-alterframe', name: 'GPT secundario', short: LOCAL_CONFIG.labels?.['gpt-alterframe'] || 'GPT secundario', sub: 'Cuenta guardada en este equipo', icon: Sparkles },
  { id: 'ia-nico', name: LOCAL_CONFIG.labels?.['ia-nico'] || 'Portal IA', short: LOCAL_CONFIG.labels?.['ia-nico'] || 'Portal IA', sub: 'Portal de trabajo', icon: PanelsTopLeft }
];
const MESSAGING_APPS = [
  { id: 'wa-personal', name: 'WhatsApp Personal', short: 'WhatsApp Personal', icon: MessageCircle },
  { id: 'wa-work', name: 'WhatsApp Laburo', short: 'WhatsApp Laburo', icon: MessageCircle },
  { id: 'telegram', name: 'Telegram', short: 'Telegram 1', icon: Send },
  { id: 'telegram-2', name: 'Telegram 2', short: 'Telegram 2', icon: Send },
  { id: 'telegram-3', name: 'Telegram 3', short: 'Telegram 3', icon: Send },
  { id: 'telegram-4', name: 'Telegram 4', short: 'Telegram 4', icon: Send }
];
const DEFAULT_MICROINFLUENCERS_URL = (LOCAL_CONFIG.urls?.microinfluencers || 'https://example.com/');
const TABS = [
  { id: 'messaging', title: 'Mensajería', icon: MessageCircle },
  { id: 'documents', title: 'Documentos', icon: FolderOpen },
  { id: 'timer', title: 'Reloj', icon: AlarmClock },
  { id: 'tasks', title: 'Tareas', icon: ListChecks }
];

const TAB_IDS = TABS.map(item => item.id);
const DEFAULT_AI_WORKSPACE = [
  { id: 'chat-default-personal', service: 'gpt-personal', name: 'GPT Personal', url: 'https://chatgpt.com/', customName: false },
  { id: 'chat-default-alterframe', service: 'gpt-alterframe', name: LOCAL_CONFIG.labels?.['chat-default-alterframe'] || 'GPT secundario', url: 'https://chatgpt.com/', customName: false },
  { id: 'chat-default-nico', service: 'ia-nico', name: LOCAL_CONFIG.labels?.['chat-default-nico'] || 'Portal IA', url: (LOCAL_CONFIG.urls?.['ia-nico'] || 'https://chatgpt.com/'), customName: false }
];
const AI_PROVIDER_TABS_MIGRATION = 'workhub-ai-provider-tabs-migrated-v1';
function loadAiWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem('workhub-ai-chat-tabs') || 'null');
    const valid = Array.isArray(saved) ? saved.filter(item => AI_APPS.some(app => app.id === item?.service) && typeof item.id === 'string') : [];
    if (valid.length) {
      const current = valid.map(item => ({ ...item, name: String(item.name || 'Chat IA'), url: String(item.url || ''), customName: Boolean(item.customName) }));
      if (!localStorage.getItem(AI_PROVIDER_TABS_MIGRATION)) {
        for (const providerTab of DEFAULT_AI_WORKSPACE) {
          if (!current.some(item => item.service === providerTab.service)) current.push(providerTab);
        }
        localStorage.setItem(AI_PROVIDER_TABS_MIGRATION, 'done');
      }
      return current;
    }
  } catch {}
  try { localStorage.setItem(AI_PROVIDER_TABS_MIGRATION, 'done'); } catch {}
  return DEFAULT_AI_WORKSPACE;
}
function loadNameOverrides(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
}
function normalizeAiSplitPanes(value, aiTabs) {
  const source = Array.isArray(value) && value.length === 2 ? value : DEFAULT_SPLIT_PANES;
  return source.map((pane, index) => {
    const section = TAB_IDS.includes(pane?.section) ? pane.section : DEFAULT_SPLIT_PANES[index].section;
    if (section !== 'ai') {
      const choices = SPLIT_SUBOPTIONS[section] || [];
      const sub = choices.some(option => option.id === pane?.sub) ? pane.sub : choices[0]?.id || '';
      return { section, sub };
    }
    const current = aiTabs.find(item => item.id === pane?.sub) || aiTabs.find(item => item.service === pane?.sub) || aiTabs[0];
    return { section: 'ai', sub: current?.id || DEFAULT_AI_WORKSPACE[0].id };
  });
}
function aiViewId(item) { return `ai-chat-${item.id}::${item.service}`; }
const DEFAULT_FOLDER_TABS = [];
function makeDefaultNav() {
  const order = (() => { try { const old = JSON.parse(localStorage.getItem('workhub-tab-order') || 'null'); return Array.isArray(old) ? [...old.filter((id, i) => TAB_IDS.includes(id) && old.indexOf(id) === i), ...TAB_IDS.filter(id => !old.includes(id))] : TAB_IDS; } catch { return TAB_IDS; } })();
  const folder = { type: 'folder', id: 'folder-social', name: 'Redes y agenda', open: false, children: order.filter(id => DEFAULT_FOLDER_TABS.includes(id)) };
  let inserted = false;
  const items = [];
  for (const id of order) {
    if (DEFAULT_FOLDER_TABS.includes(id)) { if (!inserted) { items.push(folder); inserted = true; } }
    else items.push({ type: 'tab', id });
  }
  return items;
}
function loadNavItems() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('workhub-tab-structure') || 'null'); } catch {}
  if (!Array.isArray(saved)) return makeDefaultNav();
  const result = [], seen = new Set();
  for (const item of saved) {
    if (item?.type === 'tab' && TAB_IDS.includes(item.id) && !seen.has(item.id)) { result.push({ type: 'tab', id: item.id }); seen.add(item.id); }
    else if (item?.type === 'folder' && typeof item.id === 'string' && typeof item.name === 'string') {
      const children = Array.isArray(item.children) ? item.children.filter(id => TAB_IDS.includes(id) && !seen.has(id)) : [];
      children.forEach(id => seen.add(id));
      result.push({ type: 'folder', id: item.id, name: item.name, open: Boolean(item.open), children });
    }
  }
  TAB_IDS.filter(id => !seen.has(id)).forEach(id => result.push({ type: 'tab', id }));
  return result;
}
function removeTab(items, tabId) {
  return items.map(item => item.type === 'folder' ? { ...item, children: item.children.filter(id => id !== tabId) } : item).filter(item => item.type !== 'tab' || item.id !== tabId);
}

function App() {
  const [tab, setTab] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('workhub-global-panels') || 'null'); const active = Array.isArray(saved) ? [...saved].reverse().find(panel => TAB_IDS.includes(panel?.section))?.section : null; if (active) return active; } catch {}
    return 'messaging';
  });
  const [aiTabs, setAiTabs] = useState(loadAiWorkspace);
  const [activeAiTabId, setActiveAiTabId] = useState(() => localStorage.getItem('workhub-ai-active-tab') || DEFAULT_AI_WORKSPACE[0].id);
  const [visibleAiTabIds, setVisibleAiTabIds] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('workhub-ai-visible-tabs') || 'null'); return Array.isArray(saved) ? saved : [DEFAULT_AI_WORKSPACE[0].id]; } catch { return [DEFAULT_AI_WORKSPACE[0].id]; }
  });
  const [aiChatDialog, setAiChatDialog] = useState(null);
  const [aiDialogError, setAiDialogError] = useState('');
  const [messageOrder, setMessageOrder] = useState(() => {
    const ids = MESSAGING_APPS.map(app => app.id);
    try { const saved = JSON.parse(localStorage.getItem('msghub-message-order') || '[]'); return [...new Set([...(Array.isArray(saved) ? saved.filter(id => ids.includes(id)) : []), ...ids])]; } catch { return ids; }
  });
  const [draggedMessageId, setDraggedMessageId] = useState(null);
  const [messageDropTarget, setMessageDropTarget] = useState(null);
  useEffect(() => { localStorage.setItem('msghub-message-order', JSON.stringify(messageOrder)); }, [messageOrder]);
  const [draggedAiTabId, setDraggedAiTabId] = useState(null);
  const [aiDropTarget, setAiDropTarget] = useState(null);
  const [aiGridRatios, setAiGridRatios] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('workhub-ai-grid-ratios') || 'null'); return { x: Math.max(25,Math.min(75,Number(saved?.x)||50)), x2: Math.max(43,Math.min(82,Number(saved?.x2)||66.67)), y: Math.max(25,Math.min(75,Number(saved?.y)||50)) }; } catch { return { x:50, x2:66.67, y:50 }; }
  });
  const [globalPanels, setGlobalPanels] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('workhub-global-panels') || 'null'); const valid = Array.isArray(saved) ? saved.filter(panel => TAB_IDS.includes(panel?.section)).slice(0,4) : []; return valid.length ? valid : [{ section: 'messaging' }]; } catch { return [{ section: 'messaging' }]; }
  });
  const [navItems, setNavItems] = useState(loadNavItems);
  const [tabNames, setTabNames] = useState(() => loadNameOverrides('msghub-tab-names'));
  const [messagingAppNames, setMessagingAppNames] = useState(() => loadNameOverrides('msghub-messaging-app-names'));
  const [draggedItem, setDraggedItem] = useState(null);
  const [tabContext, setTabContext] = useState(null);
  const [folderDialog, setFolderDialog] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('workhub-theme') === 'light' ? 'light' : 'dark');
  const [visibleMessageIds, setVisibleMessageIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('workhub-visible-messaging-apps') || 'null');
      const valid = Array.isArray(saved) ? MESSAGING_APPS.map(app => app.id).filter(id => saved.includes(id)) : [];
      return valid.length ? valid : ['wa-personal'];
    } catch { return ['wa-personal']; }
  });
  const [activeMessageId, setActiveMessageId] = useState(() => {
    const saved = localStorage.getItem('workhub-active-messaging-app');
    return MESSAGING_APPS.some(app => app.id === saved) ? saved : 'wa-personal';
  });
  const [mutedMessageIds, setMutedMessageIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('msghub-muted-messaging-apps') || 'null');
      if (Array.isArray(saved)) return MESSAGING_APPS.map(app => app.id).filter(id => saved.includes(id));
    } catch {}
    return localStorage.getItem('workhub-work-mode') === 'true' ? MESSAGING_APPS.map(app => app.id) : [];
  });
  const workMode = MESSAGING_APPS.every(app => mutedMessageIds.includes(app.id));
  const [microUrl, setMicroUrl] = useState(() => localStorage.getItem('workhub-microinfluencers-url') || DEFAULT_MICROINFLUENCERS_URL);
  const [microUrlDraft, setMicroUrlDraft] = useState(() => localStorage.getItem('workhub-microinfluencers-url') || DEFAULT_MICROINFLUENCERS_URL);
  const [selectedMailIds, setSelectedMailIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('workhub-selected-mail-accounts') || 'null');
      const valid = Array.isArray(saved) ? saved.filter(id => EMAILS.some(account => account.id === id)) : [];
      return valid.length ? EMAILS.map(account => account.id).filter(id => valid.includes(id)) : EMAILS.map(account => account.id);
    } catch { return EMAILS.map(account => account.id); }
  });
  const [calendarAccount, setCalendarAccount] = useState('gmail-laacade');
  const [folder, setFolder] = useState(() => localStorage.getItem('workhub-folder') || '');
  const [splitDocs, setSplitDocs] = useState(() => {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('workhub-docs-panes') || '[]'); } catch {}
    return [0, 1, 2, 3].map(index => ({ folder: saved[index]?.folder || localStorage.getItem('workhub-folder') || '', stack: Array.isArray(saved[index]?.stack) ? saved[index].stack : [], entries: [], filter: '', selectedPaths: [], selectionAnchor: '' }));
  });
  const [updateFolder, setUpdateFolder] = useState('');
  const [entries, setEntries] = useState([]);
  const [folderStack, setFolderStack] = useState([]);
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [selectionAnchor, setSelectionAnchor] = useState('');
  const [filter, setFilter] = useState('');
  const clipboardWrite = useRef(Promise.resolve());
  const [documentMenu, setDocumentMenu] = useState(null);
  const [documentStatus, setDocumentStatus] = useState('');
  const documentBusy = useRef(false);
  const [patchError, setPatchError] = useState('');
  const [patchBusy, setPatchBusy] = useState(false);
  const [patchDragActive, setPatchDragActive] = useState(false);
  const [viewError, setViewError] = useState(null);
  const [layoutKey, setLayoutKey] = useState(0);
  const inDesktop = Boolean(window.workhub);
  const [desktopUpdating, setDesktopUpdating] = useState(false);
  const [desktopVersion, setDesktopVersion] = useState('1.7.0');
  useEffect(() => { window.workhub?.desktopReady?.().then(result => { if (result?.version) setDesktopVersion(result.version); }).catch(() => {}); }, []);
  async function installDesktopPatch() {
    if (desktopUpdating) return;
    setDesktopUpdating(true);
    try {
      const result = await window.workhub.desktopUpdate();
      if (!result?.ok) window.alert(result?.error || 'No se pudo instalar el parche.');
    } catch (error) { window.alert(error.message || 'No se pudo instalar el parche.'); }
    finally { setDesktopUpdating(false); }
  }

  useEffect(() => {
    localStorage.setItem('workhub-theme', theme);
    window.workhub?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('msghub-muted-messaging-apps', JSON.stringify(mutedMessageIds));
    localStorage.setItem('workhub-work-mode', String(workMode));
    window.workhub?.setMessagingMutes(mutedMessageIds);
  }, [mutedMessageIds, workMode]);

  const activeAiTab = aiTabs.find(item => item.id === activeAiTabId) || aiTabs[0] || DEFAULT_AI_WORKSPACE[0];
  const selectedAiTabs = useMemo(() => {
    const selected = visibleAiTabIds.map(id => aiTabs.find(item => item.id === id)).filter(Boolean).slice(0, 4);
    return selected.length ? selected : [activeAiTab];
  }, [visibleAiTabIds, aiTabs, activeAiTab]);
  const aiViewTargets = useMemo(() => Object.fromEntries(aiTabs.map(item => [aiViewId(item), item.url || ''])), [aiTabs]);
  const viewTargets = useMemo(() => ({ ...aiViewTargets, microinfluencers: microUrl, ...Object.fromEntries(globalPanels.flatMap((panel, index) => panel.section === 'microinfluencers' ? [[`global-${index}::microinfluencers`, microUrl]] : [])) }), [aiViewTargets, microUrl, globalPanels]);
  useEffect(() => { localStorage.setItem('workhub-microinfluencers-url', microUrl); }, [microUrl]);
  useEffect(() => { localStorage.setItem('workhub-ai-chat-tabs', JSON.stringify(aiTabs)); }, [aiTabs]);
  useEffect(() => { localStorage.setItem('workhub-ai-active-tab', activeAiTab.id); }, [activeAiTab.id]);
  useEffect(() => { localStorage.setItem('workhub-ai-visible-tabs', JSON.stringify(selectedAiTabs.map(item => item.id))); }, [selectedAiTabs]);
  useEffect(() => { localStorage.setItem('workhub-ai-grid-ratios', JSON.stringify(aiGridRatios)); }, [aiGridRatios]);
  useEffect(() => { localStorage.setItem('workhub-selected-mail-accounts', JSON.stringify(selectedMailIds)); }, [selectedMailIds]);
  useEffect(() => { localStorage.setItem('workhub-visible-messaging-apps', JSON.stringify(visibleMessageIds)); }, [visibleMessageIds]);
  useEffect(() => { localStorage.setItem('workhub-active-messaging-app', activeMessageId); }, [activeMessageId]);

  useEffect(() => { localStorage.setItem('workhub-global-panels', JSON.stringify(globalPanels)); }, [globalPanels]);
  useEffect(() => { localStorage.setItem('msghub-tab-names', JSON.stringify(tabNames)); }, [tabNames]);
  useEffect(() => { localStorage.setItem('msghub-messaging-app-names', JSON.stringify(messagingAppNames)); }, [messagingAppNames]);
  useEffect(() => {
    localStorage.setItem('workhub-docs-panes', JSON.stringify(splitDocs.map(({ folder: root, stack }) => ({ folder: root, stack }))));
  }, [splitDocs]);

  function panelViewId(panel, index = 0) {
    if (!panel) return null;
    if (panel.section === 'messaging') return `global-${index}::${activeMessageId}`;
    if (panel.section === 'gmail') return `global-${index}::${selectedMailIds[0] || 'gmail-laacade'}`;
    if (panel.section === 'calendar') return `global-${index}::calendar-${calendarAccount.replace('gmail-', '')}`;
    if (panel.section === 'facebook' || panel.section === 'linkedin') return `global-${index}::${panel.section}`;
    if (panel.section === 'microinfluencers') return `global-${index}::microinfluencers`;
    if (panel.section === 'ai') { const item = aiTabs.find(candidate => candidate.id === panel.sub) || activeAiTab; return aiViewId(item); }
    return null;
  }
  const globalViewIds = useMemo(() => globalPanels.map((panel, index) => panel.section === 'documents' ? null : panelViewId(panel, index)), [globalPanels, activeMessageId, selectedMailIds, calendarAccount, aiTabs, activeAiTab]);
  const mixedGlobalPanels = globalPanels.length > 1 && !(globalPanels.every(panel => panel.section === 'ai'));
  const multiAiGlobal = globalPanels.length > 1 && globalPanels.every(panel => panel.section === 'ai');

  const viewIds = useMemo(() => {
    if (tab === 'messaging') return messageOrder.filter(id => visibleMessageIds.includes(id));
    if (tab === 'gmail') return selectedMailIds;
    if (tab === 'ai') return selectedAiTabs.map(aiViewId);
    if (tab === 'facebook' || tab === 'linkedin' || tab === 'microinfluencers') return [tab];
    if (tab === 'calendar') return [calendarAccount.replace('gmail-', 'calendar-')];
    return [];
  }, [tab, messageOrder, visibleMessageIds, selectedMailIds, selectedAiTabs, calendarAccount]);

  useEffect(() => {
    if (!inDesktop) return;
    const update = () => {
      const chrome = document.querySelector('.chrome');
      const overlay = document.querySelector('.overlay-bar, .global-layout-bar');
      const caption = document.querySelector('.remote-label, .mosaic-label, .messaging-mosaic-label');
      const top = (chrome?.getBoundingClientRect().height || 0) + (overlay?.getBoundingClientRect().height || 0) + (caption?.getBoundingClientRect().height || 0);
      const modalOpen = Boolean(folderDialog || aiChatDialog || documentMenu);
      if (chrome) {
        const globalIds = modalOpen ? null : mixedGlobalPanels ? globalViewIds : tab === 'messaging' && viewIds.length > 1 ? viewIds : null;
        const aiIds = !modalOpen && (multiAiGlobal ? globalViewIds : tab === 'ai' && !mixedGlobalPanels ? viewIds : null);
        window.workhub.layout(modalOpen ? [] : globalIds ? [] : viewIds, top, globalIds, aiGridRatios.x, aiIds, aiGridRatios, viewTargets);
      }
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    const chrome = document.querySelector('.chrome');
    if (chrome) observer.observe(chrome);
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); };
  }, [inDesktop, viewIds, layoutKey, folderDialog, aiChatDialog, documentMenu, globalViewIds, mixedGlobalPanels, multiAiGlobal, tab, viewTargets]);

  useEffect(() => {
    if (!inDesktop || !window.workhub.onSplitRatiosChanged) return;
    return window.workhub.onSplitRatiosChanged(ratios => {
      if (!ratios || !Number.isFinite(ratios.x) || !Number.isFinite(ratios.y)) return;
      setAiGridRatios(current => current.x === ratios.x && current.y === ratios.y && current.x2 === ratios.x2 ? current : ratios);
    });
  }, [inDesktop]);

  useEffect(() => {
    if (!inDesktop) return;
    window.workhub.onViewError(e => setViewError(e));
  }, [inDesktop]);

  useEffect(() => window.workhub?.onAttachmentDragStatus?.(setDocumentStatus), []);

  useEffect(() => {
    if (!inDesktop || !window.workhub.onAiViewNavigation) return;
    return window.workhub.onAiViewNavigation(({ viewId, url }) => {
      if (!url) return;
      const item = aiTabs.find(candidate => aiViewId(candidate) === viewId);
      if (item && item.url !== url) setAiTabs(current => current.map(candidate => candidate.id === item.id ? { ...candidate, url } : candidate));
    });
  }, [inDesktop, aiTabs]);

  useEffect(() => {
    const path = folderStack.at(-1) || folder;
    if (path && inDesktop) window.workhub.listFolder(path).then(setEntries);
    else setEntries([]);
  }, [folder, folderStack, inDesktop]);

  useEffect(() => {
    if (!folder || !inDesktop) { setUpdateFolder(''); return; }
    let cancelled = false;
    window.workhub.ensurePatchFolder(folder).then(path => {
      if (cancelled) return;
      setUpdateFolder(path || '');
      if (path && folderStack.length === 0) window.workhub.listFolder(folder).then(items => { if (!cancelled) setEntries(items); });
    });
    return () => { cancelled = true; };
  }, [folder, inDesktop]);

  const splitDocPaths = splitDocs.map((doc, index) => doc.stack.at(-1) || doc.folder || folder);
  useEffect(() => {
    if (!inDesktop || !mixedGlobalPanels) return;
    globalPanels.forEach((pane, index) => {
      const slot = Number.isInteger(pane.slot) ? pane.slot : index;
      if (pane.section !== 'documents' || !splitDocPaths[slot]) return;
      const target = splitDocPaths[slot];
      window.workhub.listFolder(target).then(items => setSplitDocs(current => current.map((doc, i) => {
        const currentPath = doc.stack.at(-1) || doc.folder || folder;
        return i === slot && currentPath === target ? { ...doc, entries: items } : doc;
      })));
    });
  }, [inDesktop, mixedGlobalPanels, globalPanels, splitDocPaths[0], splitDocPaths[1], splitDocPaths[2], splitDocPaths[3], folder]);

  function updateSplitDoc(index, patch) {
    setSplitDocs(current => current.map((doc, i) => i === index ? { ...doc, ...patch } : doc));
  }
  function pickFolder(paneIndex = null) {
    if (!inDesktop) return;
    window.workhub.pickFolder().then(value => {
      if (!value) return;
      if (paneIndex !== null) updateSplitDoc(paneIndex, { folder: value, stack: [], entries: [], filter: '' });
      else { setFolder(value); localStorage.setItem('workhub-folder', value); setFolderStack([]); setSelectedPaths([]); setSelectionAnchor(''); }
    });
  }
  async function createDocumentFolder(parent, name, paneIndex = null) {
    const result = await window.workhub.createFolder(parent, name);
    if (!result?.ok) throw new Error(result?.error || 'No se pudo crear la carpeta.');
    const updatedEntries = await window.workhub.listFolder(parent);
    if (paneIndex === null) setEntries(updatedEntries);
    else updateSplitDoc(paneIndex, { entries: updatedEntries, selectedPaths: [], selectionAnchor: '' });
    setDocumentStatus(`Carpeta “${name.trim()}” creada.`);
  }
  function isUpdatePath(path) { return Boolean(updateFolder) && path.replace(/[\\/]+$/,'').toLowerCase() === updateFolder.replace(/[\\/]+$/,'').toLowerCase(); }
  async function dropPatchFiles(event) {
    event.preventDefault();
    setPatchDragActive(false);
    setPatchError('');
    const files = [...(event.dataTransfer?.files || [])].map(file => window.workhub.getPathForFile(file)).filter(Boolean);
    if (!files.length) { setPatchError('No pude leer los archivos soltados. Probá arrastrar el ZIP desde el Explorador de Windows.'); return; }
    const result = await window.workhub.stagePatches(files);
    if (!result?.ok) { setPatchError(result?.error || 'No se pudo importar el ZIP.'); return; }
    setEntries(await window.workhub.listFolder(currentFolder));
  }
  async function applyPatch(file) {
    if (!window.confirm('MSG Hub se va a cerrar, aplicar este parche y volver a abrirse. ¿Continuar?')) return;
    setPatchError('');
    setPatchBusy(true);
    const result = await window.workhub.applyPatch(file);
    if (!result?.ok) { setPatchError(result?.error || 'No se pudo iniciar el parche.'); setPatchBusy(false); }
  }
  async function startDocumentDrag(items) {
    if (!items?.length || !window.workhub?.startFileDrag) return;
    const result = await window.workhub.startFileDrag(items, 'auto');
    if (!result?.ok) setDocumentStatus(result?.error || 'No se pudo iniciar el arrastre del archivo.');
  }
  async function refreshDocumentsAfterTransfer() {
    const mainPath = currentFolder;
    const refreshes = [];
    if (mainPath) refreshes.push(window.workhub.listFolder(mainPath).then(setEntries));
    for (let index = 0; index < 4; index++) {
      const docPanel = globalPanels.find((panel, panelIndex) => panel.section === 'documents' && (Number.isInteger(panel.slot) ? panel.slot : panelIndex) === index);
      const path = splitDocPaths[index];
      if (!path || !mixedGlobalPanels || !docPanel) continue;
      refreshes.push(window.workhub.listFolder(path).then(items => setSplitDocs(current => current.map((doc, i) => {
        const currentPath = doc.stack.at(-1) || doc.folder || folder;
        return i === index && currentPath === path ? { ...doc, entries: items } : doc;
      }))));
    }
    await Promise.all(refreshes);
  }
  async function dropDocumentFiles(event, destinationFolder) {
    event.preventDefault();
    if (!inDesktop) return;
    const internalPayload = event.dataTransfer?.getData('application/x-workhub-files') || event.dataTransfer?.getData('text/plain') || '';
    let items = [];
    if (internalPayload.startsWith('workhub-files:')) {
      try { items = JSON.parse(internalPayload.slice('workhub-files:'.length)).filter(item => item?.path); } catch { items = []; }
    }
    if (!items.length) items = [...(event.dataTransfer?.files || [])].map(file => ({ path: window.workhub.getPathForFile(file) })).filter(item => item.path);
    if (!items.length) return;
    const operation = event.ctrlKey ? 'copy' : event.shiftKey ? 'move' : 'auto';
    event.stopPropagation();
    await runDocumentAction(async () => {
      const result = await window.workhub.transferFiles(items, destinationFolder, operation);
      await refreshDocumentsAfterTransfer();
      if (result?.cancelled) { setDocumentStatus('Operación cancelada.'); return; }
      if (!result?.ok) throw new Error(result?.error || 'No se pudieron transferir los elementos.');
      setDocumentStatus(`${result.transferred ?? items.length} elemento(s) transferidos.`);
    }, 'Transfiriendo archivos…');
  }
  async function runDocumentAction(action, message) {
    if (documentBusy.current) return;
    documentBusy.current = true;
    setDocumentStatus(message);
    try { await action(); }
    catch (error) { setDocumentStatus(error.message || 'No se pudo completar la operación.'); }
    finally { documentBusy.current = false; }
  }
  function copyDocumentSelection(items, operation) {
    if (!items.length) return;
    setDocumentStatus(operation === 'move' ? 'Preparando para mover…' : 'Copiando al portapapeles…');
    const pending = clipboardWrite.current.catch(() => {}).then(() => window.workhub.writeFileClipboard(items, operation));
    clipboardWrite.current = pending;
    pending.then(result => setDocumentStatus(result?.ok ? `${items.length} elemento(s) listos para pegar.` : result?.error || 'No se pudo usar el portapapeles.'), error => setDocumentStatus(error.message));
    return pending;
  }
  async function pasteDocumentItems(destinationFolder) {
    return runDocumentAction(async () => {
      const writeResult = await clipboardWrite.current;
      if (writeResult?.ok === false) throw new Error(writeResult.error || 'No se pudo copiar la selección.');
      const clipboard = await window.workhub.readFileClipboard();
      if (clipboard?.error) throw new Error(clipboard.error);
      if (!clipboard?.paths?.length) { setDocumentStatus('No hay archivos en el portapapeles.'); return; }
      const result = await window.workhub.transferFiles(clipboard.paths, destinationFolder, clipboard.operation || 'copy');
      await refreshDocumentsAfterTransfer();
      if (result?.cancelled) { setDocumentStatus('Operación cancelada.'); return; }
      if (!result?.ok) throw new Error(result?.error || 'No se pudieron pegar los archivos.');
      if (clipboard.operation === 'move') await window.workhub.clearFileClipboard();
      setDocumentStatus(`${result.transferred ?? clipboard.paths.length} elemento(s) transferidos.`);
    }, 'Pegando archivos…');
  }
  async function deleteDocumentSelection(items) {
    if (!items.length) return;
    return runDocumentAction(async () => {
      const result = await window.workhub.trashFiles(items);
      await refreshDocumentsAfterTransfer();
      if (result?.cancelled) { setDocumentStatus('Eliminación cancelada.'); return; }
      if (!result?.ok) throw new Error(result?.error || 'No se pudieron eliminar los archivos.');
      setDocumentStatus('Elementos enviados a la Papelera.');
    }, 'Enviando a la Papelera…');
  }
  function saveNav(next) {
    setNavItems(next);
    localStorage.setItem('workhub-tab-structure', JSON.stringify(next));
  }
  function startNavDrag(type, id, event) {
    const payload = `${type}:${id}`;
    setDraggedItem({ type, id });
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', payload);
  }
  function handleNavDrop(targetType, targetId, event) {
    event.preventDefault();
    event.stopPropagation();
    const raw = event.dataTransfer.getData('text/plain');
    const split = raw.indexOf(':');
    const sourceType = split > 0 ? raw.slice(0, split) : draggedItem?.type;
    const sourceId = split > 0 ? raw.slice(split + 1) : draggedItem?.id;
    if (!sourceType || !sourceId || (sourceType === targetType && sourceId === targetId)) return;
    let next = structuredClone(navItems);
    if (sourceType === 'tab' && targetType === 'folder') {
      next = removeTab(next, sourceId);
      const group = next.find(item => item.type === 'folder' && item.id === targetId);
      if (group && !group.children.includes(sourceId)) { group.children.push(sourceId); group.open = true; }
    } else if (sourceType === 'tab' && targetType === 'tab') {
      const targetFolder = next.find(item => item.type === 'folder' && item.children.includes(targetId));
      const sourceFolder = next.find(item => item.type === 'folder' && item.children.includes(sourceId));
      next = removeTab(next, sourceId);
      if (targetFolder && sourceFolder?.id === targetFolder.id) {
        const group = next.find(item => item.type === 'folder' && item.id === targetFolder.id);
        group.children.splice(group.children.indexOf(targetId), 0, sourceId);
      } else if (targetFolder) {
        const group = next.find(item => item.type === 'folder' && item.id === targetFolder.id);
        group.children.splice(group.children.indexOf(targetId), 0, sourceId);
        group.open = true;
      } else {
        const at = next.findIndex(item => item.type === 'tab' && item.id === targetId);
        next.splice(at < 0 ? next.length : at, 0, { type: 'tab', id: sourceId });
      }
    } else if (sourceType === 'tab' && targetType === 'end') {
      next = removeTab(next, sourceId);
      next.push({ type: 'tab', id: sourceId });
    } else if (sourceType === 'folder' && targetType === 'folder') {
      const from = next.findIndex(item => item.type === 'folder' && item.id === sourceId);
      const to = next.findIndex(item => item.type === 'folder' && item.id === targetId);
      if (from >= 0 && to >= 0) next.splice(to, 0, next.splice(from, 1)[0]);
    } else if (sourceType === 'folder' && targetType === 'tab') {
      const from = next.findIndex(item => item.type === 'folder' && item.id === sourceId);
      const to = next.findIndex(item => item.type === 'tab' && item.id === targetId);
      if (from >= 0 && to >= 0) next.splice(to, 0, next.splice(from, 1)[0]);
    } else if (sourceType === 'folder' && targetType === 'end') {
      const from = next.findIndex(item => item.type === 'folder' && item.id === sourceId);
      if (from >= 0) next.push(next.splice(from, 1)[0]);
    }
    saveNav(next);
  }
  function createFolderFromTab(tabId) {
    setFolderDialog({ mode: 'create-tab', name: 'Nueva carpeta', tabId });
  }
  function createEmptyFolder() {
    setFolderDialog({ mode: 'create-empty', name: 'Nueva carpeta' });
  }
  function submitFolderDialog() {
    const name = folderDialog?.name?.trim();
    if (!name) return;
    if (folderDialog.mode === 'create-document') {
      createDocumentFolder(folderDialog.parent, name, folderDialog.paneIndex).then(() => setFolderDialog(null)).catch(error => window.alert(error.message));
      return;
    }
    if (folderDialog.mode === 'rename') {
      saveNav(navItems.map(item => item.type === 'folder' && item.id === folderDialog.folderId ? { ...item, name } : item));
    } else if (folderDialog.mode === 'rename-tab') {
      setTabNames(current => ({ ...current, [folderDialog.tabId]: name }));
    } else if (folderDialog.mode === 'rename-messaging-app') {
      setMessagingAppNames(current => ({ ...current, [folderDialog.appId]: name }));
    } else if (folderDialog.mode === 'create-tab') {
      const next = removeTab(navItems, folderDialog.tabId);
      next.push({ type: 'folder', id: `folder-${Date.now()}`, name, open: true, children: [folderDialog.tabId] });
      saveNav(next);
    } else {
      saveNav([...navItems, { type: 'folder', id: `folder-${Date.now()}`, name, open: true, children: [] }]);
    }
    setFolderDialog(null);
  }
  function tabName(tabId) {
    return tabNames[tabId] || TABS.find(item => item.id === tabId)?.title || tabId;
  }
  function messagingAppName(appId) {
    return messagingAppNames[appId] || MESSAGING_APPS.find(item => item.id === appId)?.name || appId;
  }
  function handleTabContext(action, target) {
    setTabContext(null);
    if (action === 'rename') {
      if (target.type === 'tab') setFolderDialog({ mode: 'rename-tab', tabId: target.id, name: tabName(target.id) });
      else if (target.type === 'messaging-app') setFolderDialog({ mode: 'rename-messaging-app', appId: target.id, name: messagingAppName(target.id) });
      else if (target.type === 'folder') setFolderDialog({ mode: 'rename', name: target.name, folderId: target.id });
      return;
    }
    if (target.type === 'folder') {
      if (action === 'rename') {
        setFolderDialog({ mode: 'rename', name: target.name, folderId: target.id });
      } else if (action === 'delete') {
        const next = [];
        navItems.forEach(item => item.type === 'folder' && item.id === target.id ? item.children.forEach(id => next.push({ type: 'tab', id })) : next.push(item));
        saveNav(next);
      } else if (action === 'toggle') saveNav(navItems.map(item => item.type === 'folder' && item.id === target.id ? { ...item, open: !item.open } : item));
      return;
    }
    if (action === 'create') createFolderFromTab(target.id);
    else if (action === 'ungroup') { const next = removeTab(navItems, target.id); next.push({ type: 'tab', id: target.id }); saveNav(next); }
    else if (action.startsWith('move:')) {
      const folderId = action.slice(5); let next = removeTab(navItems, target.id);
      const group = next.find(item => item.type === 'folder' && item.id === folderId);
      if (group) { group.children.push(target.id); group.open = true; saveNav(next); }
    }
  }
  function focusMailAccount(accountId) {
    setSelectedMailIds([accountId]);
    setTab('gmail'); setViewError(null); setLayoutKey(n => n + 1);
  }
  function toggleMailAccount(accountId) {
    setSelectedMailIds(current => current.includes(accountId)
      ? (current.length > 1 ? current.filter(id => id !== accountId) : current)
      : EMAILS.map(account => account.id).filter(id => current.includes(id) || id === accountId));
    setTab('gmail'); setViewError(null); setLayoutKey(n => n + 1);
  }
  function selectTab(id) {
    setGlobalPanels([{ section: id, ...(id === 'ai' ? { sub: activeAiTab.id } : {}) }]);
    if (id === 'ai') setVisibleAiTabIds([activeAiTab.id]);
    setTab(id); setViewError(null); setLayoutKey(n => n + 1);
    if (id === 'microinfluencers') setTimeout(() => window.workhub?.reloadView('microinfluencers'), 120);
  }
  function applyMicroUrl() {
    const candidate = microUrlDraft.trim();
    if (candidate) {
      try {
        const parsed = new URL(candidate);
        if (!(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))) throw new Error();
      } catch { window.alert('Pegá un enlace válido que empiece con https://. Para una prueba local, se admite http://localhost.'); return; }
    }
    setMicroUrl(candidate);
    setLayoutKey(value => value + 1);
    if (candidate === microUrl) {
      const index = globalPanels.findIndex(panel => panel.section === 'microinfluencers');
      const viewId = globalPanels.length > 1 && index >= 0 ? `global-${index}::microinfluencers` : 'microinfluencers';
      setTimeout(() => window.workhub?.reloadView(viewId), 160);
    }
  }
  function toggleGlobalPanel(section, sub = null) {
    const usedDocSlots = new Set(globalPanels.flatMap((panel, index) => panel.section === 'documents' ? [Number.isInteger(panel.slot) ? panel.slot : index] : []));
    const target = { section, ...(section === 'ai' ? { sub: sub || activeAiTab.id } : {}), ...(section === 'documents' ? { slot: [0,1,2,3].find(value => !usedDocSlots.has(value)) ?? 0 } : {}) };
    const same = panel => panel.section === section && (section !== 'ai' || panel.sub === target.sub);
    let next = globalPanels;
    if (globalPanels.some(same)) next = globalPanels.filter(panel => !same(panel));
    else {
      if (section !== 'ai') {
        const selectedAi = globalPanels.filter(panel => panel.section === 'ai');
        if (selectedAi.length > 2) next = [...globalPanels.filter(panel => panel.section !== 'ai'), ...selectedAi.slice(0, 2)];
      }
      if (next.length >= 4) { window.alert('Podés seleccionar hasta cuatro paneles.'); return; }
      if (section === 'ai' && globalPanels.some(panel => panel.section !== 'ai') && globalPanels.filter(panel => panel.section === 'ai').length >= 2) { window.alert('En una vista combinada podés mostrar hasta dos chats de IA.'); return; }
      next = [...next, target];
    }
    setGlobalPanels(next);
    if (section === 'ai') {
      const currentAiIds = globalPanels.filter(panel => panel.section === 'ai').map(panel => panel.sub);
      setActiveAiTabId(target.sub);
      setVisibleAiTabIds(current => current.includes(target.sub) ? current.filter(id => id !== target.sub) : [...new Set([...current.filter(id => currentAiIds.includes(id)), target.sub])].slice(-4));
    }
    setTab(next.at(-1)?.section || section); setViewError(null); setLayoutKey(n => n + 1);
  }
  function toggleNavPanel(section) {
    if (section !== 'ai') { toggleGlobalPanel(section); return; }
    const currentAi = globalPanels.filter(panel => panel.section === 'ai');
    if (currentAi.length) {
      const remaining = globalPanels.filter(panel => panel.section !== 'ai');
      setGlobalPanels(remaining);
      setVisibleAiTabIds([activeAiTab.id]);
      setTab(remaining.at(-1)?.section || 'ai');
    } else { toggleGlobalPanel('ai', activeAiTab.id); setVisibleAiTabIds([activeAiTab.id]); }
    setViewError(null); setLayoutKey(n => n + 1);
  }
  function addDocumentsPanel() {
    if (globalPanels.length >= 4) { window.alert('Podés seleccionar hasta cuatro paneles.'); return; }
    const existingIndex = globalPanels.findIndex(panel => panel.section === 'documents');
    const existingPanel = existingIndex >= 0 ? globalPanels[existingIndex] : null;
    const existingSlot = existingPanel ? (Number.isInteger(existingPanel.slot) ? existingPanel.slot : existingIndex) : null;
    const used = new Set(globalPanels.flatMap((panel, index) => panel.section === 'documents' ? [Number.isInteger(panel.slot) ? panel.slot : index] : []));
    const slot = [0,1,2,3].find(value => !used.has(value));
    if (slot == null) { window.alert('Ya tenés cuatro vistas de Documentos abiertas.'); return; }
    const source = existingSlot == null ? { folder: folder || currentFolder, stack: folderStack } : splitDocs[existingSlot];
    if (existingSlot != null && !Number.isInteger(existingPanel.slot)) {
      setSplitDocs(current => current.map((doc, index) => index === existingSlot ? { ...doc, folder: source.folder || currentFolder, stack: source.stack || [], entries: [] } : doc));
    }
    setSplitDocs(current => current.map((doc, index) => index === slot ? { ...doc, folder: source.folder || currentFolder, stack: [...(source.stack || [])], entries: [], filter: '', selectedPaths: [], selectionAnchor: '' } : doc));
    setGlobalPanels(current => [...current.map((panel, index) => panel.section === 'documents' && !Number.isInteger(panel.slot) ? { ...panel, slot: index } : panel), { section: 'documents', slot }]);
    setTab('documents'); setViewError(null); setLayoutKey(n => n + 1);
  }
  function closeDocumentsPanel(slot) {
    const remaining = globalPanels.filter((panel, index) => !(panel.section === 'documents' && (Number.isInteger(panel.slot) ? panel.slot : index) === slot));
    if (!remaining.length) return;
    if (remaining.length === 1 && remaining[0].section === 'documents') {
      const remainingSlot = Number.isInteger(remaining[0].slot) ? remaining[0].slot : globalPanels.findIndex(panel => panel.section === 'documents');
      const doc = splitDocs[remainingSlot];
      if (doc) {
        setFolder(doc.folder || folder);
        setFolderStack(doc.stack || []);
        setEntries(doc.entries || []);
        setFilter(doc.filter || '');
        setSelectedPaths(doc.selectedPaths || []);
        setSelectionAnchor(doc.selectionAnchor || '');
        if (doc.folder || folder) localStorage.setItem('workhub-folder', doc.folder || folder);
      }
      setGlobalPanels([{ section: 'documents' }]);
      setTab('documents');
    } else {
      setGlobalPanels(remaining);
      if (tab === 'documents' && !remaining.some(panel => panel.section === 'documents')) setTab(remaining.at(-1).section);
    }
    setViewError(null); setLayoutKey(n => n + 1);
  }
  function focusAiChat(id) {
    setActiveAiTabId(id);
    setVisibleAiTabIds([id]);
    setAiDialogError('');
    setGlobalPanels([{ section: 'ai', sub: id }]);
    setTab('ai');
    setViewError(null);
  }
  function focusMessageApp(id) {
    setActiveMessageId(id);
    setVisibleMessageIds([id]);
    setGlobalPanels([{ section: 'messaging' }]);
    setTab('messaging');
    setViewError(null);
    setLayoutKey(n => n + 1);
  }
  function toggleMessageVisible(id) {
    const selected = visibleMessageIds;
    let next = selected;
    if (selected.includes(id)) {
      if (selected.length > 1) next = selected.filter(item => item !== id);
    } else if (selected.length < 3) next = [...selected, id];
    setVisibleMessageIds(next);
    setActiveMessageId(selected.includes(id) ? (next.includes(activeMessageId) ? activeMessageId : next[0]) : id);
    setGlobalPanels([{ section: 'messaging' }]);
    setTab('messaging');
    setViewError(null);
    setLayoutKey(n => n + 1);
  }
  function toggleMessagingMute(id) {
    setMutedMessageIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  function toggleAllMessagingMute() {
    const silenceAll = !workMode;
    setMutedMessageIds(silenceAll ? MESSAGING_APPS.map(app => app.id) : []);
  }
  function toggleAiChatVisible(id) {
    if (globalPanels.some(panel => panel.section !== 'ai')) {
      const aiPanels = globalPanels.filter(panel => panel.section === 'ai');
      const targetExists = aiPanels.some(panel => panel.sub === id);
      const nonAi = globalPanels.filter(panel => panel.section !== 'ai');
      let next = globalPanels;
      if (targetExists) next = globalPanels.filter(panel => !(panel.section === 'ai' && panel.sub === id));
      else if (aiPanels.length >= 2) { window.alert('En una vista combinada podés mostrar hasta dos chats de IA.'); return; }
      else if (globalPanels.length >= 4) { window.alert('Podés seleccionar hasta cuatro paneles.'); return; }
      else next = [...nonAi, ...aiPanels, { section: 'ai', sub: id }];
      setGlobalPanels(next);
      setVisibleAiTabIds(next.filter(panel => panel.section === 'ai').map(panel => panel.sub));
    } else {
      const selected = globalPanels.length ? globalPanels.filter(panel => panel.section === 'ai').map(panel => panel.sub) : selectedAiTabs.map(item => item.id);
      if (selected.includes(id)) {
        if (selected.length > 1) { const next = selected.filter(tabId => tabId !== id); setGlobalPanels(next.map(sub => ({ section:'ai', sub }))); setVisibleAiTabIds(next); }
      } else if (selected.length >= 4) window.alert('Podés mostrar hasta cuatro chats a la vez. Desmarcá uno para agregar otro.');
      else { const next = [...selected, id]; setGlobalPanels(next.map(sub => ({ section:'ai', sub }))); setVisibleAiTabIds(next); }
    }
    setActiveAiTabId(id);
    setTab('ai');
    setViewError(null);
  }
  function openAiChatDialog() {
    const app = AI_APPS.find(item => item.id === activeAiTab.service) || AI_APPS[0];
    setAiDialogError('');
    setAiChatDialog({ service: app.id, name: `${app.short} ${aiTabs.length + 1}`, url: '' });
  }
  function createAiChat(event) {
    event?.preventDefault();
    if (!aiChatDialog) return;
    const app = AI_APPS.find(item => item.id === aiChatDialog.service) || AI_APPS[0];
    const inputUrl = aiChatDialog.url.trim();
    const url = inputUrl || (app.id === 'ia-nico' ? (LOCAL_CONFIG.urls?.['ia-nico'] || 'https://chatgpt.com/') : 'https://chatgpt.com/');
    try {
      const parsed = new URL(url);
      const allowedHost = app.id === 'ia-nico' ? parsed.hostname === 'portal-colegas.vercel.app' : parsed.hostname === 'chatgpt.com';
      if (parsed.protocol !== 'https:' || !allowedHost) throw new Error();
    } catch { setAiDialogError(app.id === 'ia-nico' ? 'Usá un enlace HTTPS de portal-colegas.vercel.app.' : 'Usá un enlace HTTPS de chatgpt.com.'); return; }
    const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const name = aiChatDialog.name.trim() || `${app.short} ${aiTabs.length + 1}`;
    const item = { id, service: app.id, name, url, customName: true };
    setAiTabs(current => [...current, item]);
    setAiChatDialog(null);
    focusAiChat(id);
  }
  function renameAiChat(item) {
    const name = window.prompt('Nombre de esta subpestaña', item.name);
    if (name?.trim()) setAiTabs(current => current.map(candidate => candidate.id === item.id ? { ...candidate, name: name.trim(), customName: true } : candidate));
  }
  function reorderAiChatTabs(sourceId, targetId, insertAfter) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setAiTabs(current => {
      const sourceIndex = current.findIndex(item => item.id === sourceId);
      const targetIndex = current.findIndex(item => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(sourceIndex, 1);
      let destination = reordered.findIndex(item => item.id === targetId);
      if (destination < 0) return current;
      if (insertAfter) destination++;
      reordered.splice(destination, 0, moved);
      return reordered;
    });
  }
  function closeAiChat(item) {
    if (aiTabs.length === 1) {
      const replacement = { ...DEFAULT_AI_WORKSPACE[0], id: `chat-${Date.now()}-personal` };
      window.workhub?.closeAiView(aiViewId(item));
      setAiTabs([replacement]); setActiveAiTabId(replacement.id); setVisibleAiTabIds([replacement.id]);
      setGlobalPanels(current => current.map(pane => pane.section === 'ai' && pane.sub === item.id ? { ...pane, sub: replacement.id } : pane));
      return;
    }
    const next = aiTabs.filter(candidate => candidate.id !== item.id);
    const fallback = next[0];
    window.workhub?.closeAiView(aiViewId(item));
    setAiTabs(next);
    setActiveAiTabId(current => current === item.id ? fallback.id : current);
    setVisibleAiTabIds(current => {
      const remaining = current.filter(id => id !== item.id && next.some(candidate => candidate.id === id));
      return remaining.length ? remaining : [fallback.id];
    });
    setGlobalPanels(current => current.map(pane => pane.section === 'ai' && pane.sub === item.id ? { ...pane, sub: fallback.id } : pane));
  }
  async function reloadPanel(viewId, login = false) {
    setViewError(null);
    const result = await window.workhub?.reloadView(viewId, login);
    if (result && !result.ok) window.alert('No se pudo cargar el panel: ' + result.error);
  }
  function refreshVisible() {
    setViewError(null);
    (mixedGlobalPanels ? globalViewIds.filter(Boolean) : viewIds).forEach(id => reloadPanel(id));
    setLayoutKey(n => n + 1);
  }
  function formatSize(size) {
    if (size == null) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size/1024).toFixed(0)} KB`;
    return `${(size/1024/1024).toFixed(1)} MB`;
  }
  function iconFor(item) {
    if (item.directory) return Folder;
    const ext = item.name.split('.').pop().toLowerCase();
    if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return Image;
    if (['doc','docx','txt','pdf','md'].includes(ext)) return FileText;
    if (['xls','xlsx','csv'].includes(ext)) return Table2;
    if (['mp4','mov','mkv'].includes(ext)) return Film;
    return File;
  }
  const currentFolder = folderStack.at(-1) || folder;
  const currentTab = TABS.find(t => t.id === tab);
  const CurrentIcon = currentTab?.icon || PanelsTopLeft;
  function renderDocumentsPane(paneIndex = null) {
    const doc = paneIndex === null ? null : splitDocs[paneIndex];
    const activeFolder = doc ? (doc.stack.at(-1) || doc.folder || folder) : currentFolder;
    const activeStack = doc ? doc.stack : folderStack;
    const activeEntries = doc ? doc.entries : entries;
    const activeFilter = doc ? doc.filter : filter;
    const selected = doc ? (doc.selectedPaths || []) : selectedPaths;
    const anchor = doc ? (doc.selectionAnchor || '') : selectionAnchor;
    const visibleEntries = activeEntries.filter(item => item.name.toLowerCase().includes(activeFilter.toLowerCase()));
    const setActiveStack = updater => {
      if (paneIndex === null) { setFolderStack(updater); setSelectedPaths([]); setSelectionAnchor(''); }
      else setSplitDocs(current => current.map((item, i) => i === paneIndex ? { ...item, stack: typeof updater === 'function' ? updater(item.stack) : updater, selectedPaths: [], selectionAnchor: '' } : item));
    };
    const setActiveEntries = updater => paneIndex === null ? setEntries(updater) : setSplitDocs(current => current.map((item, i) => i === paneIndex ? { ...item, entries: typeof updater === 'function' ? updater(item.entries) : updater } : item));
    const setActiveFilter = value => { paneIndex === null ? (setFilter(value), setSelectedPaths([]), setSelectionAnchor('')) : updateSplitDoc(paneIndex, { filter: value, selectedPaths: [], selectionAnchor: '' }); };
    const setSelection = (paths, nextAnchor = anchor) => paneIndex === null ? (setSelectedPaths(paths), setSelectionAnchor(nextAnchor)) : updateSplitDoc(paneIndex, { selectedPaths: paths, selectionAnchor: nextAnchor });
    const folderPicker = () => pickFolder(paneIndex);
    const refreshFolder = () => window.workhub.listFolder(activeFolder).then(setActiveEntries);
    const changeFolder = path => { setActiveStack(stack => [...stack, path]); };
    const goBack = () => setActiveStack(stack => stack.slice(0, -1));
    const goToProjects = () => {
      setActiveStack([]);
      setActiveFilter('');
      setSelection([],'');
    };
    const selectedItems = () => visibleEntries.filter(item => selected.includes(item.path));
    const displayFolder = (() => {
      if (!activeFolder.startsWith('zip://')) return activeFolder;
      const marker = activeFolder.indexOf('!/');
      if (marker < 0) return activeFolder;
      try {
        const archivePath = decodeURIComponent(activeFolder.slice(6, marker));
        const inner = activeFolder.slice(marker + 2).split('/').filter(Boolean).map(part => decodeURIComponent(part)).join('\\');
        return inner ? `${archivePath}  ›  ${inner}` : `${archivePath}  ›  (ZIP)`;
      } catch { return activeFolder; }
    })();
    const handleSelect = (event, item) => {
      const current = selected;
      if (event.shiftKey && anchor) {
        const from = visibleEntries.findIndex(entry => entry.path === anchor);
        const to = visibleEntries.findIndex(entry => entry.path === item.path);
        if (from >= 0 && to >= 0) {
          const range = visibleEntries.slice(Math.min(from, to), Math.max(from, to) + 1).map(entry => entry.path);
          setSelection(event.ctrlKey || event.metaKey ? [...new Set([...current, ...range])] : range, anchor);
        } else setSelection([item.path], item.path);
      } else if (event.ctrlKey || event.metaKey) {
        const next = current.includes(item.path) ? current.filter(value => value !== item.path) : [...current, item.path];
        setSelection(next, item.path);
      } else setSelection([item.path], item.path);
      event.currentTarget.focus();
    };
    const handleDocumentKeys = event => {
      if ((event.target instanceof HTMLInputElement) || (event.target instanceof HTMLTextAreaElement)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault(); setFolderDialog({ mode: 'create-document', name: 'Nueva carpeta', parent: activeFolder, paneIndex });
      } else if (modifier && event.key.toLowerCase() === 'a') {
        event.preventDefault(); setSelection(visibleEntries.map(item => item.path), visibleEntries[0]?.path || '');
      } else if (modifier && ['c','x'].includes(event.key.toLowerCase())) {
        event.preventDefault(); copyDocumentSelection(selectedItems(), event.key.toLowerCase() === 'x' ? 'move' : 'copy');
      } else if (modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault(); pasteDocumentItems(activeFolder);
      } else if (event.key === 'Delete') {
        event.preventDefault(); deleteDocumentSelection(selectedItems());
      } else if (event.key === 'Enter' && selected.length === 1) {
        event.preventDefault(); const item = visibleEntries.find(entry => entry.path === selected[0]);
        if (item?.directory) changeFolder(item.path); else if (item) window.workhub.openFile(item.path);
      }
    };
    const onDropOver = event => {
      const types = [...(event.dataTransfer?.types || [])];
      if (event.dataTransfer?.files?.length || types.includes('Files') || types.includes('application/x-workhub-files')) {
        event.preventDefault();
        if (event.ctrlKey) event.dataTransfer.dropEffect = 'copy';
        else if (event.shiftKey) event.dataTransfer.dropEffect = 'move';
        else {
          const internal = types.includes('application/x-workhub-files');
          const drive = value => String(value || '').match(/^[a-z]:/i)?.[0]?.toLowerCase() || String(value || '').match(/^\\\\[^\\]+\\[^\\]+/)?.[0]?.toLowerCase() || '';
          const sourcePath = event.dataTransfer.files[0] ? window.workhub.getPathForFile(event.dataTransfer.files[0]) : '';
          const sameDrive = internal || (drive(sourcePath) && drive(sourcePath) === drive(activeFolder));
          event.dataTransfer.dropEffect = sameDrive ? 'move' : 'copy';
        }
      }
    };
    const rowDragStart = (event, item) => {
      const items = selected.includes(item.path) ? selectedItems() : [item];
      if (!selected.includes(item.path)) setSelection([item.path], item.path);
      const hasMessagingDropTarget = globalPanels.some(panel => panel.section === 'messaging');
      if (hasMessagingDropTarget && !item.directory) {
        const unsupported = items.some(entry => entry.directory || entry.path.startsWith('zip://'));
        if (unsupported) {
          event.preventDefault();
          setDocumentStatus('Para adjuntar, elegí archivos normales; primero extraé el contenido de un ZIP.');
          return;
        }
        try {
          const result = window.workhub.beginAttachmentDrag(items.map(({ path }) => path));
          if (!result?.token) throw new Error(result?.error || 'No se pudo preparar el arrastre.');
          event.dataTransfer.setData('application/x-workhub-attachment', result.token);
          event.dataTransfer.setData('text/plain', `workhub-attachment:${result.token}`);
          event.dataTransfer.setData('application/x-workhub-files', `workhub-files:${JSON.stringify(items.map(({ path, directory }) => ({ path, directory: Boolean(directory) })))}`);
          event.dataTransfer.effectAllowed = 'copy';
          setDocumentStatus('Soltá el archivo sobre el chat para adjuntarlo.');
        } catch (error) {
          event.preventDefault();
          setDocumentStatus(error.message || 'No se pudo preparar el arrastre.');
        }
        return;
      }
      const payload = JSON.stringify(items.map(({ path, directory }) => ({ path, directory: Boolean(directory) })));
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('application/x-workhub-files', `workhub-files:${payload}`);
      event.dataTransfer.setData('text/plain', `workhub-files:${payload}`);
    };
    const showDocumentMenu = (event, item = null) => {
      event.preventDefault(); event.stopPropagation();
      const items = item ? (selected.includes(item.path) ? selectedItems() : [item]) : selectedItems();
      if (item && !selected.includes(item.path)) setSelection([item.path], item.path);
      setDocumentMenu({ x: Math.min(event.clientX, window.innerWidth - 230), y: Math.min(event.clientY, window.innerHeight - 245), items, folder: activeFolder, paneIndex });
    };
    return <div className="documents-page" tabIndex={0} onKeyDownCapture={handleDocumentKeys} onMouseDown={event => { if (!event.target.closest('input,button,[role="button"]')) event.currentTarget.focus({ preventScroll: true }); }} onContextMenu={showDocumentMenu}>
      <aside className="file-sidebar"><div className="side-overline">ESPACIO DE TRABAJO</div><button className={`side-selected ${activeStack.length ? '' : 'at-root'}`} aria-current={activeStack.length ? undefined : 'page'} title="Volver a la carpeta principal de proyectos" onClick={goToProjects}><FolderOpen size={17}/> Proyectos</button><div className="side-note"><HardDrive size={16}/><span>Acceso a una carpeta local de este equipo</span></div><div className="side-security"><ShieldCheck size={16}/><span>Los archivos se abren desde su ubicación original. No se copian a la app.</span></div></aside>
      <section className="file-content" onDragOver={onDropOver} onDrop={event=>dropDocumentFiles(event,activeFolder)}>
        <div className="file-heading"><div><div className="breadcrumb">MI ESPACIO <span>/</span> DOCUMENTOS{isUpdatePath(activeFolder) && <><span>/</span> ACTUALIZACION</>}</div><h1>{isUpdatePath(activeFolder) ? 'Actualizaciones de MSG Hub' : 'Carpeta de proyectos'}</h1><p>{isUpdatePath(activeFolder) ? 'Soltá aquí el ZIP del parche o guardalo en esta carpeta. Después elegí Aplicar y reiniciar.' : 'Explorá, seleccioná y organizá tus archivos.'}</p></div><button className="primary-button" onClick={folderPicker}><FolderOpen size={16}/>{(doc?.folder || folder) ? 'Cambiar carpeta' : 'Elegir carpeta'}</button></div>
        {!(doc?.folder || folder) ? <div className="empty-folder"><div className="empty-icon"><FolderOpen size={28}/></div><h2>Elegí tu carpeta de proyectos</h2><p>Cuando la crees, seleccionála acá. MSG Hub recordará esta ubicación para la próxima vez.</p><button className="primary-button" onClick={folderPicker}>Seleccionar carpeta</button></div> : <>
          <div className="path-row"><button className="back-button" onClick={goBack} disabled={!activeStack.length}><ArrowLeft size={16}/></button><div className="path-text"><FolderOpen size={15}/><span title={displayFolder}>{displayFolder}</span></div><div className="searchbox"><Search size={15}/><input placeholder="Buscar en esta carpeta" value={activeFilter} onChange={e=>setActiveFilter(e.target.value)}/></div><span className="file-selection-count">{selected.length ? `${selected.length} seleccionados` : ''}</span><button className="icon-button" disabled={!selected.length} onClick={()=>copyDocumentSelection(selectedItems(),'copy')} title="Copiar (Ctrl+C)"><Copy size={15}/></button><button className="icon-button" disabled={!selected.length} onClick={()=>copyDocumentSelection(selectedItems(),'move')} title="Cortar (Ctrl+X)"><Scissors size={15}/></button><button className="icon-button" onClick={()=>pasteDocumentItems(activeFolder)} title="Pegar (Ctrl+V)"><ClipboardPaste size={15}/></button><button className="icon-button" disabled={!selected.length} onMouseDown={event=>{if(event.button===0){event.preventDefault();startDocumentDrag(selectedItems());}}} title="Mantené presionado y arrastrá la selección a Mensajería"><ExternalLink size={15}/></button><button className="icon-button" onClick={refreshFolder} title="Actualizar"><RefreshCw size={15}/></button></div>
          {patchError && <div className="patch-error" role="alert">{patchError}</div>}
          <div className={`file-table ${isUpdatePath(activeFolder) ? 'is-update-folder' : ''}`} tabIndex={0} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.focus();}}>
            <div className="file-table-head"><span>Nombre</span><span>Tipo</span><span>{isUpdatePath(activeFolder)?'Acción':'Tamaño'}</span></div>
            {visibleEntries.map(item=>{const Icon=iconFor(item);const patchFile=isUpdatePath(activeFolder)&&!item.directory&&item.name.toLowerCase().endsWith('.zip');return <div className={`file-row ${selected.includes(item.path)?'selected':''}`} role="button" aria-selected={selected.includes(item.path)} tabIndex={0} draggable onDragStart={event=>rowDragStart(event,item)} onContextMenu={event=>showDocumentMenu(event,item)} onDragOver={onDropOver} onDrop={event=>{event.stopPropagation();dropDocumentFiles(event,item.directory && !item.archive ? item.path : activeFolder);}} key={item.path} onDoubleClick={()=>item.directory?changeFolder(item.path):window.workhub.openFile(item.path)} onClick={event=>handleSelect(event,item)} onKeyDown={event=>{if(event.key===' '){event.preventDefault();handleSelect({...event,ctrlKey:true,currentTarget:event.currentTarget},item);}}}><span className="file-name"><Icon size={18} className={item.directory?'folder-color':''}/>{item.name}</span><span>{item.directory?'Carpeta':item.name.split('.').pop().toUpperCase()}</span><span>{patchFile?<button className="patch-apply-button" disabled={patchBusy} onClick={event=>{event.stopPropagation();applyPatch(item.path);}}>Aplicar y reiniciar</button>:item.directory?'—':formatSize(item.size)}</span></div>;})}
            {visibleEntries.length===0&&<div className="no-files">{isUpdatePath(activeFolder)?'Soltá aquí el ZIP de actualización.':'Esta carpeta está vacía.'}</div>}
          </div>
          <div className="document-status" role="status">{documentStatus}</div><div className="file-footnote">Seleccioná varios elementos con Ctrl o Shift. Ctrl+C copia, Ctrl+X corta y Ctrl+V pega. Arrastrá para mover según las reglas de Windows; los archivos dentro de un ZIP se extraen al soltarlos en otra carpeta.</div>
        </>}
      </section>
    </div>;
  }

  return <div className="app-shell" data-theme={theme}>
    <header className="chrome">
      <div className="titlebar">
        <div className="brand"><div className="brand-mark"><img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22512%22%20height%3D%22512%22%20viewBox%3D%220%200%20512%20512%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x2%3D%22.8%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%2336d683%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%230c9953%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20x%3D%2216%22%20y%3D%2216%22%20width%3D%22480%22%20height%3D%22480%22%20rx%3D%22120%22%20fill%3D%22url%28%23g%29%22%2F%3E%3Cpath%20d%3D%22M183%20142h154c53%200%2087%2037%2087%2088v50c0%2048-33%2085-83%2085h-32l-59%2044v-44h-67c-50%200-84-36-84-85v-50c0-51%2034-88%2084-88z%22%20fill%3D%22%23006b40%22%20opacity%3D%22.32%22%2F%3E%3Cpath%20d%3D%22M177%20111h142c54%200%2089%2037%2089%2089v39c0%2051-34%2088-86%2088H205l-82%2062%2011-84c-29-15-46-40-46-74v-31c0-52%2035-89%2089-89z%22%20fill%3D%22%23fff%22%2F%3E%3Cg%20fill%3D%22%23149d59%22%3E%3Ccircle%20cx%3D%22176%22%20cy%3D%22220%22%20r%3D%2219%22%2F%3E%3Ccircle%20cx%3D%22248%22%20cy%3D%22220%22%20r%3D%2219%22%2F%3E%3Ccircle%20cx%3D%22320%22%20cy%3D%22220%22%20r%3D%2219%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E" alt=""/></div><span>MSG<span className="brand-light">Hub</span></span><span className="private-chip"><ShieldCheck size={12}/> PRIVADO</span></div>
        <div className="titlebar-actions">
          {inDesktop && <button className="desktop-update-button" onClick={installDesktopPatch} disabled={desktopUpdating} title="Buscar actualizaciones de MSG Hub"><RefreshCw size={13}/><span>{desktopUpdating ? 'Actualizando…' : 'Actualizar programa'}</span></button>}
          <button className={`work-mode-toggle ${workMode ? 'enabled' : ''}`} onClick={toggleAllMessagingMute} aria-pressed={workMode} title={workMode ? 'Todas las cuentas de mensajería están silenciadas. Tocá para activar el sonido en todas.' : 'Tocá para silenciar todas las cuentas. También podés silenciarlas por separado desde sus controles.'}><span className="work-mode-indicator"/><span>Modo laburo</span><strong>{workMode ? 'ON' : 'OFF'}</strong></button>
          <button className="theme-toggle" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`} title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}>{theme === 'dark' ? <Moon size={13}/> : <Sun size={13}/>}<span>{theme === 'dark' ? 'Dark' : 'Light'}</span></button>
          <div className="window-controls"><button aria-label="Minimizar" onClick={() => window.workhub?.windowControl('minimize')}>−</button><button aria-label="Maximizar" onClick={() => window.workhub?.windowControl('maximize')}>□</button><button className="close-window" aria-label="Cerrar" onClick={() => window.workhub?.windowControl('close')}>×</button></div>
        </div>
      </div>
      <nav className="tabs" aria-label="Secciones" onDragOver={event => event.preventDefault()} onDrop={event => handleNavDrop('end', '', event)} onContextMenu={event => { if (event.target === event.currentTarget) { event.preventDefault(); createEmptyFolder(); } }}>
        {navItems.flatMap(item => item.type === 'tab' ? [{ type: 'tab', id: item.id }] : [{ type: 'folder', id: item.id, name: item.name, open: item.open, children: item.children }, ...(item.open ? item.children.map(id => ({ type: 'tab', id, parent: item.id })) : [])]).map(node => {
          if (node.type === 'folder') return <button key={node.id} type="button" draggable className={`tab folder-tab ${node.open ? 'folder-open' : ''} ${node.children?.some(id => id === tab) ? 'contains-active' : ''}`} onClick={() => handleTabContext('toggle', navItems.find(item => item.type === 'folder' && item.id === node.id))} onContextMenu={event => { event.preventDefault(); setTabContext({ x: event.clientX, y: event.clientY, target: { type: 'folder', ...node } }); }} onDragStart={event => startNavDrag('folder', node.id, event)} onDragOver={event => event.preventDefault()} onDrop={event => handleNavDrop('folder', node.id, event)} onDragEnd={() => setDraggedItem(null)} title={`${node.name} · clic para abrir/cerrar · clic derecho para opciones`}><Folder size={16}/><span>{node.name}</span><ChevronDown size={12} className="folder-chevron"/></button>;
          const item = TABS.find(entry => entry.id === node.id); if (!item) return null; const Icon = item.icon;
          const checked = globalPanels.some(panel => panel.section === item.id);
          return <div key={item.id} className={`tab-entry ${node.parent ? 'nested-entry' : ''}`}>
            <button type="button" draggable className={`tab ${tab === item.id ? 'active' : ''} ${node.parent ? 'nested-tab' : ''}`} onClick={() => selectTab(item.id)} onContextMenu={event => { event.preventDefault(); setTabContext({ x: event.clientX, y: event.clientY, target: { type: 'tab', id: item.id } }); }} onDragStart={event => startNavDrag('tab', item.id, event)} onDragOver={event => event.preventDefault()} onDrop={event => handleNavDrop('tab', item.id, event)} onDragEnd={() => setDraggedItem(null)} title={`${tabName(item.id)}${node.parent ? ' · en carpeta' : ''} · clic para abrir · clic derecho para cambiar el nombre`}><Icon size={16} strokeWidth={2}/><span>{tabName(item.id)}</span>{tab === item.id && <i/>}</button>
            <button type="button" className={`tab-check ${checked ? 'checked' : ''}`} aria-label={`${checked ? 'Quitar' : 'Agregar'} ${tabName(item.id)} ${checked ? 'de' : 'a'} la vista`} aria-pressed={checked} title={`${checked ? 'Quitar' : 'Agregar'} ${tabName(item.id)} ${checked ? 'de' : 'a'} la vista dividida`} onClick={() => toggleNavPanel(item.id)}>{checked ? '✓' : ''}</button>
          </div>;
        })}
        <div className="tabbar-utilities">
          {inDesktop && <span className="session-status"><span/> Sesiones guardadas en este equipo</span>}
          <button className="icon-button" title="Recargar páginas visibles" onClick={refreshVisible}><RefreshCw size={15}/></button>
        </div>
      </nav>
      {tabContext && <div className="tab-context-backdrop" onClick={() => setTabContext(null)} onContextMenu={event => { event.preventDefault(); setTabContext(null); }}><div className="tab-context-menu" style={{ left: Math.min(tabContext.x, window.innerWidth - 230), top: Math.min(tabContext.y, window.innerHeight - 220) }} onClick={event => event.stopPropagation()}>
        <button onClick={() => handleTabContext('rename', tabContext.target)}><Pencil size={14}/>Cambiar nombre</button>
        {tabContext.target.type === 'folder' && <button onClick={() => handleTabContext('delete', tabContext.target)}><Trash2 size={14}/>Eliminar carpeta y dejar pestañas afuera</button>}
        {tabContext.target.type === 'tab' && <><button onClick={() => handleTabContext('create', tabContext.target)}><FolderPlus size={14}/>Crear carpeta con esta pestaña</button>{navItems.filter(item => item.type === 'folder').map(group => <button key={group.id} onClick={() => handleTabContext(`move:${group.id}`, tabContext.target)}><Folder size={14}/>Mover a {group.name}</button>)}{navItems.some(item => item.type === 'folder' && item.children.includes(tabContext.target.id)) && <button onClick={() => handleTabContext('ungroup', tabContext.target)}><ExternalLink size={14}/>Sacar de la carpeta</button>}</>}
      </div></div>}
      {viewError && <div className="error-banner">No se pudo cargar esta página ({viewError.code}). Revisá la conexión o probá abrir el sitio en el navegador.</div>}
    </header>

    {folderDialog && createPortal(<div className="folder-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFolderDialog(null); }}><form className="folder-dialog" onSubmit={event => { event.preventDefault(); submitFolderDialog(); }}><label htmlFor="folder-name">{folderDialog.mode === 'rename' ? 'Cambiar nombre de carpeta' : folderDialog.mode.startsWith('rename-') ? 'Cambiar nombre de ventana' : 'Crear carpeta'}</label><input id="folder-name" autoFocus maxLength={40} value={folderDialog.name} onChange={event => setFolderDialog({ ...folderDialog, name: event.target.value })} onKeyDown={event => event.stopPropagation()} /><div><button type="button" onClick={() => setFolderDialog(null)}>Cancelar</button><button type="submit" disabled={!folderDialog.name.trim()}>{folderDialog.mode.startsWith('rename') ? 'Guardar' : 'Crear'}</button></div></form></div>, document.body)}

    {aiChatDialog && createPortal(<div className="folder-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAiChatDialog(null); }}><form className="folder-dialog ai-chat-dialog" onSubmit={createAiChat}>
      <label htmlFor="ai-chat-service">Agregar subpestaña de IA</label>
      <span className="ai-dialog-caption">Cada subpestaña conserva su propio chat y navegación.</span>
      <select id="ai-chat-service" value={aiChatDialog.service} onChange={event => setAiChatDialog(current => ({ ...current, service: event.target.value }))}>{AI_APPS.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select>
      <input autoFocus maxLength={50} value={aiChatDialog.name} onChange={event => setAiChatDialog(current => ({ ...current, name: event.target.value }))} placeholder="Nombre, por ejemplo: Microinfluencers" aria-label="Nombre de la subpestaña" />
      <input value={aiChatDialog.url} onChange={event => setAiChatDialog(current => ({ ...current, url: event.target.value }))} placeholder="Enlace de un chat/proyecto existente (opcional)" aria-label="Enlace de chat existente" />
      <span className="ai-dialog-caption">Sin enlace abre una vista nueva. Para un proyecto, podés abrirlo desde la barra lateral de la IA y MSG Hub conservará la última dirección usada.</span>
      {aiDialogError && <span className="ai-dialog-error" role="alert">{aiDialogError}</span>}
      <div><button type="button" onClick={() => setAiChatDialog(null)}>Cancelar</button><button type="submit">Abrir subpestaña</button></div>
    </form></div>, document.body)}

    {documentMenu && createPortal(<div className="document-menu-backdrop" onMouseDown={() => setDocumentMenu(null)} onContextMenu={event => { event.preventDefault(); setDocumentMenu(null); }}><div className="document-menu" role="menu" style={{left:documentMenu.x,top:documentMenu.y}} onMouseDown={event=>event.stopPropagation()}>
      <button role="menuitem" disabled={documentMenu.folder.startsWith('zip://')} onClick={()=>{setFolderDialog({mode:'create-document',name:'Nueva carpeta',parent:documentMenu.folder,paneIndex:documentMenu.paneIndex});setDocumentMenu(null);}}>Nueva carpeta <span>Ctrl+Mayús+N</span></button>
      <div className="document-menu-separator"/>
      <button role="menuitem" disabled={!documentMenu.items.length} onMouseDown={event=>{if(event.button===0){event.preventDefault();startDocumentDrag(documentMenu.items);setDocumentMenu(null);}}}>Arrastrar a otra vista <span>WhatsApp · Telegram</span></button>
      <button role="menuitem" disabled={!documentMenu.items.length} onClick={()=>{copyDocumentSelection(documentMenu.items,'copy');setDocumentMenu(null);}}>Copiar <span>Ctrl+C</span></button>
      <button role="menuitem" disabled={!documentMenu.items.length} onClick={()=>{copyDocumentSelection(documentMenu.items,'move');setDocumentMenu(null);}}>Cortar <span>Ctrl+X</span></button>
      <button role="menuitem" onClick={()=>{pasteDocumentItems(documentMenu.folder);setDocumentMenu(null);}}>Pegar <span>Ctrl+V</span></button>
      <button role="menuitem" disabled={!documentMenu.items.length || documentMenu.items.some(item=>item.path.startsWith('zip://'))} onClick={()=>{deleteDocumentSelection(documentMenu.items);setDocumentMenu(null);}}>Eliminar <span>Supr · Papelera</span></button>
    </div></div>,document.body)}
    {mixedGlobalPanels ? <>
      <section className="global-layout-bar"><span>{globalPanels.length} paneles seleccionados</span>{globalPanels.map((panel, panelIndex) => panel.section === 'ai' && <label key={`ai-choice-${panelIndex}`}>Chat IA {globalPanels.filter(item => item.section === 'ai').length > 1 ? globalPanels.filter(item => item.section === 'ai').findIndex(item => item === panel) + 1 : ''}<select value={panel.sub || activeAiTab.id} onChange={event => { const id = event.target.value; setGlobalPanels(current => current.map((item, index) => index === panelIndex ? { ...item, sub: id } : item)); setActiveAiTabId(id); }} aria-label={`Chat de IA en el panel ${panelIndex + 1}`}>{aiTabs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}{globalPanels.some(panel => panel.section === 'ai') && <label className="add-ai-panel">Agregar chat IA<select value={activeAiTab.id} onChange={event => setActiveAiTabId(event.target.value)} aria-label="Elegir chat de IA para agregar">{aiTabs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" disabled={globalPanels.some(panel => panel.section === 'ai' && panel.sub === activeAiTab.id) || globalPanels.filter(panel => panel.section === 'ai').length >= 2 || globalPanels.length >= 4} onClick={() => toggleAiChatVisible(activeAiTab.id)} aria-label="Agregar chat de IA seleccionado" title="Agregar este chat como otro panel"><Plus size={14}/></button></label>}{globalPanels.some(panel => panel.section === 'microinfluencers') && <div className="micro-url-controls"><input aria-label="Enlace de vista previa de Microinfluencers" value={microUrlDraft} onChange={event => setMicroUrlDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyMicroUrl(); } }} placeholder="Pegá el enlace de vista previa"/><button type="button" onClick={applyMicroUrl} title="Guardar enlace y recargar la vista"><RefreshCw size={13}/></button><small>390 × 844</small></div>}<span>Marcá o desmarcá pestañas para cambiar la vista · arrastrá los divisores para ajustar</span></section>
      <main className={`split-stage split-stage-${globalPanels.length}`} style={{ gridTemplateColumns: globalPanels.length === 3 ? `minmax(0, ${aiGridRatios.x}fr) minmax(0, ${aiGridRatios.x2-aiGridRatios.x}fr) minmax(0, ${100-aiGridRatios.x2}fr)` : globalPanels.length >= 2 ? `minmax(0, ${aiGridRatios.x}fr) minmax(0, ${100-aiGridRatios.x}fr)` : 'minmax(0,1fr)', gridTemplateRows: globalPanels.length === 4 ? `minmax(0, ${aiGridRatios.y}fr) minmax(0, ${100-aiGridRatios.y}fr)` : 'minmax(0,1fr)' }}>
        {globalPanels.map((pane, index) => {
          const title = pane.section === 'ai' ? (aiTabs.find(item => item.id === pane.sub)?.name || 'IA') : pane.section === 'documents' ? `${tabName('documents')} · ${index + 1}` : tabName(pane.section);
          const docSlot = Number.isInteger(pane.slot) ? pane.slot : index;
          return <section className={`split-pane ${pane.section === 'documents' ? 'split-documents' : ''} ${pane.section === 'timer' ? 'split-timer' : ''} ${pane.section === 'tasks' ? 'split-kanban' : ''}`} key={`${pane.section}-${pane.sub || pane.slot || ''}-${index}`} aria-label={title}>
            <div className="global-panel-name" onContextMenu={event => { event.preventDefault(); setTabContext({ x: event.clientX, y: event.clientY, target: { type: 'tab', id: pane.section } }); }} title="Clic derecho para cambiar el nombre"><span>{title}</span>{pane.section === 'documents' && globalPanels.length > 1 && <button type="button" className="global-panel-close" onClick={() => closeDocumentsPanel(docSlot)} aria-label={`Cerrar ${title}`} title={`Cerrar ${title}`}>×</button>}</div>
            {pane.section === 'documents' ? renderDocumentsPane(docSlot) : pane.section === 'timer' ? <TimerPane/> : pane.section === 'tasks' ? <TasksPane/> : !inDesktop ? <div className="preview-notice"><div className="notice-icon"><Columns2 size={20}/></div><div><strong>Vista disponible en MSG Hub de escritorio</strong><p>Iniciá la app para mostrar este servicio.</p></div></div> : null}
          </section>;
        })}
      </main>
    </> : <>
    {tab === 'messaging' && <section className="overlay-bar ai-bar ai-chat-bar messaging-chat-bar">
      <div className="ai-chat-tabs" role="group" aria-label="Servicios de mensajería visibles">
        {messageOrder.map(id => MESSAGING_APPS.find(app => app.id === id)).map(app => {
          const Icon = app.icon;
          const checked = visibleMessageIds.includes(app.id);
          const muted = mutedMessageIds.includes(app.id);
          return <div className={`ai-chat-tab ${activeMessageId === app.id ? 'active' : ''} ${checked ? 'checked' : ''} ${draggedMessageId === app.id ? 'dragging' : ''} ${messageDropTarget?.id === app.id ? (messageDropTarget.after ? 'drop-after' : 'drop-before') : ''}`} key={app.id} draggable
            onDragStart={event => { event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-msghub-message', app.id); setDraggedMessageId(app.id); }}
            onDragOver={event => { if (!draggedMessageId || draggedMessageId === app.id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const rect = event.currentTarget.getBoundingClientRect(); setMessageDropTarget({ id: app.id, after: event.clientX >= rect.left + rect.width / 2 }); }}
            onDrop={event => { event.preventDefault(); event.stopPropagation(); const source = event.dataTransfer.getData('application/x-msghub-message'); const rect = event.currentTarget.getBoundingClientRect(); const after = event.clientX >= rect.left + rect.width / 2; if (messageOrder.includes(source) && source !== app.id) setMessageOrder(current => { const next = current.filter(id => id !== source); next.splice(next.indexOf(app.id) + (after ? 1 : 0), 0, source); return next; }); setDraggedMessageId(null); setMessageDropTarget(null); }}
            onDragEnd={() => { setDraggedMessageId(null); setMessageDropTarget(null); }} onContextMenu={event => { event.preventDefault(); setTabContext({ x: event.clientX, y: event.clientY, target: { type: 'messaging-app', id: app.id } }); }}>
            <button type="button" className="ai-chat-check" aria-label={`${checked ? 'Quitar' : 'Agregar'} ${messagingAppName(app.id)} ${checked ? 'de' : 'a'} la vista`} aria-pressed={checked} title={checked ? 'Visible en la cuadrícula' : 'Marcar para mostrar en la cuadrícula'} onClick={() => toggleMessageVisible(app.id)}>{checked ? '✓' : ''}</button>
            <button type="button" className="ai-chat-open" onClick={() => focusMessageApp(app.id)} title={`Mostrar solo ${messagingAppName(app.id)} · clic derecho para cambiar el nombre`}><Icon size={13}/><span>{messagingAppName(app.id)}</span></button>
            <button type="button" className={`messaging-mute-button ${muted ? 'muted' : ''}`} onClick={() => toggleMessagingMute(app.id)} aria-label={`${muted ? 'Activar sonido de' : 'Silenciar'} ${messagingAppName(app.id)}`} aria-pressed={muted} title={muted ? 'Silenciada · clic para activar el sonido' : 'Con sonido · clic para silenciar'}>{muted ? <VolumeX size={13}/> : <Volume2 size={13}/>}</button>
          </div>;
        })}
      </div>
      <div className="ai-layout-tools"><span className="ai-visible-count">{visibleMessageIds.length} / 3 visibles · arrastrá para ordenar</span></div>
    </section>}

    {tab === 'gmail' && <section className="overlay-bar mail-bar">
      <div className="mail-identities" role="group" aria-label="Cuentas de correo visibles">{EMAILS.map(account => {
        const checked = selectedMailIds.includes(account.id);
        return <div key={account.id} className={`mail-account-entry ${checked ? 'selected' : ''}`}>
          <button type="button" className={`mail-chip ${selectedMailIds.length === 1 && checked ? 'chosen' : ''}`} onClick={() => focusMailAccount(account.id)} title={`Mostrar solo ${account.email}`}><span className="mail-avatar" style={{background:account.color}}>{account.short.slice(0,1)}</span><span>{account.short}</span></button>
          <button type="button" className={`mail-account-check ${checked ? 'checked' : ''}`} aria-label={`${checked ? 'Quitar' : 'Agregar'} ${account.email} de la vista`} aria-pressed={checked} title={`${checked ? 'Quitar' : 'Agregar'} ${account.email} ${checked ? 'de' : 'a'} la vista`} onClick={() => toggleMailAccount(account.id)}>{checked ? '✓' : ''}</button>
        </div>;
      })}</div>
      <span className="bar-hint mail-hint">{selectedMailIds.length} de 6 cuentas visibles · tocá el nombre para ver solo esa cuenta</span>
      <button className="text-button" onClick={() => setSelectedMailIds(EMAILS.map(account => account.id))} disabled={selectedMailIds.length === EMAILS.length}><LayoutGrid size={15}/> Todas</button>
    </section>}

    {tab === 'ai' && <section className="overlay-bar ai-bar ai-chat-bar">
      <div className="ai-chat-tabs" role="group" aria-label="Subpestañas de IA">
        {aiTabs.map(item => {
          const app = AI_APPS.find(candidate => candidate.id === item.service) || AI_APPS[0];
          const Icon = app.icon;
          const checked = selectedAiTabs.some(selected => selected.id === item.id);
          const dropBefore = aiDropTarget?.id === item.id && !aiDropTarget.after;
          const dropAfter = aiDropTarget?.id === item.id && aiDropTarget.after;
          return <div className={`ai-chat-tab ${activeAiTab.id === item.id ? 'active' : ''} ${checked ? 'checked' : ''} ${draggedAiTabId === item.id ? 'dragging' : ''} ${dropBefore ? 'drop-before' : ''} ${dropAfter ? 'drop-after' : ''}`} key={item.id} draggable onDragStart={event => {
            if (event.target.closest('.ai-chat-check,.ai-chat-close')) { event.preventDefault(); return; }
            event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id);
            setDraggedAiTabId(item.id); setAiDropTarget(null);
          }} onDragOver={event => {
            if (!draggedAiTabId || draggedAiTabId === item.id) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move';
            const bounds = event.currentTarget.getBoundingClientRect();
            const nextTarget = { id: item.id, after: event.clientX >= bounds.left + bounds.width / 2 };
            setAiDropTarget(current => current?.id === nextTarget.id && current?.after === nextTarget.after ? current : nextTarget);
          }} onDrop={event => {
            event.preventDefault();
            const sourceId = draggedAiTabId || event.dataTransfer.getData('text/plain');
            const bounds = event.currentTarget.getBoundingClientRect();
            reorderAiChatTabs(sourceId, item.id, event.clientX >= bounds.left + bounds.width / 2);
            setDraggedAiTabId(null); setAiDropTarget(null);
          }} onDragEnd={() => { setDraggedAiTabId(null); setAiDropTarget(null); }} title="Arrastrá para cambiar el orden">
            <button className="ai-chat-check" aria-label={`${checked ? 'Quitar de la vista múltiple' : 'Agregar a la vista múltiple'}: ${item.name}`} aria-pressed={checked} title={checked ? 'Visible en la cuadrícula' : 'Marcar para mostrar en la cuadrícula'} onClick={() => toggleAiChatVisible(item.id)}>{checked ? '✓' : ''}</button>
            <button className="ai-chat-open" onClick={() => focusAiChat(item.id)} onDoubleClick={event => { event.stopPropagation(); renameAiChat(item); }} title="Clic para abrir en pantalla completa · doble clic para cambiar el nombre"><Icon size={13}/><span>{item.name}</span></button>
            <button className="ai-chat-close" aria-label={`Cerrar ${item.name}`} title="Cerrar subpestaña" onClick={() => closeAiChat(item)}>×</button>
          </div>;
        })}
        <button className="ai-add-chat" title="Crear chat nuevo o abrir uno existente" onClick={openAiChatDialog}><Plus size={15}/><span>Agregar chat</span></button>
      </div>
      <div className="ai-layout-tools">

        <span className="ai-visible-count">{selectedAiTabs.length} / 4</span>
      </div>
    </section>}

    {tab === 'calendar' && <section className="overlay-bar calendar-bar">
      <label className="ai-select"><span className="slot-label">CUENTA</span><span className="select-wrap"><select value={calendarAccount} onChange={event => { setCalendarAccount(event.target.value); setViewError(null); }} aria-label="Cuenta de Calendario">{EMAILS.map(account => <option key={account.id} value={account.id}>{account.short} · {account.email}</option>)}</select><ChevronDown size={14}/></span></label>
      <span className="bar-hint">Para ver reuniones juntas, activá los calendarios vinculados en el menú de Google Calendar.</span>
    </section>}

    {tab === 'microinfluencers' && <section className="overlay-bar micro-preview-bar"><Smartphone size={15}/><span>Vista móvil</span><div className="micro-url-controls"><input aria-label="Enlace de vista previa de Microinfluencers" value={microUrlDraft} onChange={event => setMicroUrlDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyMicroUrl(); } }} placeholder="Pegá el enlace de vista previa"/><button type="button" onClick={applyMicroUrl} title="Guardar enlace y recargar"><RefreshCw size={14}/></button><small>390 × 844</small></div></section>}
    {tab === 'timer' ? <TimerPane/> : tab === 'tasks' ? <TasksPane/> : tab === 'documents' ? renderDocumentsPane() : <main className={`remote-stage stage-${tab} ${tab === 'microinfluencers' ? 'micro-preview-stage' : ''}`}>
      {!inDesktop && <div className="preview-notice"><div className="notice-icon"><CurrentIcon size={20}/></div><div><strong>La vista de servicios aparece en la app de escritorio</strong><p>Esta pantalla es una previsualización. Iniciá la app para conectar tus cuentas de WhatsApp y Telegram.</p></div><span className="preview-pill">VISTA PREVIA</span></div>}
      {tab === 'gmail' && <div className="mosaic-label">VISTA CONJUNTA <span>· {selectedMailIds.length} {selectedMailIds.length === 1 ? 'cuenta' : 'cuentas'}</span></div>}
      {tab === 'messaging' && <div className="messaging-mosaic-label" style={{ display: 'grid', gridTemplateColumns: viewIds.length === 3 ? `minmax(0, ${aiGridRatios.x}fr) minmax(0, ${aiGridRatios.x2-aiGridRatios.x}fr) minmax(0, ${100-aiGridRatios.x2}fr)` : viewIds.length === 2 ? `minmax(0, ${aiGridRatios.x}fr) minmax(0, ${100-aiGridRatios.x}fr)` : 'minmax(0,1fr)' }}>{viewIds.map(id=>{const app=MESSAGING_APPS.find(a=>a.id===id);const Icon=app.icon;return <div className="ai-panel-label" key={id}><Icon size={14}/><span>{messagingAppName(app.id)}</span></div>})}</div>}
      {inDesktop && tab !== 'documents' && <div className="remote-background"/>}
    </main>}
    </>}
    <TimerAlarmOverlay visible={tab !== 'timer'}/>
    <footer className="statusbar"><span><span className="green-dot"/> MSG Hub funciona localmente en este equipo</span><span>v{desktopVersion} · Actualización online</span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
