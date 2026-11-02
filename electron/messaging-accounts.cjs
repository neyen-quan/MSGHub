// Existing IDs are immutable: they name the user's persistent Electron profiles.
const MAX_ACCOUNTS = 8;
const DEFAULT_ACCOUNTS = [
  { id: 'wa-personal', service: 'whatsapp', name: 'WhatsApp Personal' },
  { id: 'wa-work', service: 'whatsapp', name: 'WhatsApp Laburo' },
  { id: 'telegram', service: 'telegram', name: 'Telegram' },
  ...[2, 3, 4].map(n => ({ id: `telegram-${n}`, service: 'telegram', name: `Telegram ${n}` }))
];
const EXTRA_ACCOUNTS = [7, 8].flatMap(slot => ['whatsapp', 'telegram'].map(service => ({
  id: `${service === 'whatsapp' ? 'wa' : 'telegram'}-extra-${slot}`, service,
  name: `${service === 'whatsapp' ? 'WhatsApp' : 'Telegram'} ${slot}`
})));
const ACCOUNT_CATALOG = [...DEFAULT_ACCOUNTS, ...EXTRA_ACCOUNTS];
function serviceFor(id) {
  return ACCOUNT_CATALOG.find(account => account.id === String(id || '').split('::').at(-1))?.service;
}
function loadAccounts(saved) {
  const extras = [];
  for (const item of Array.isArray(saved) ? saved : []) {
    const account = EXTRA_ACCOUNTS.find(account => account.id === item?.id);
    if (!account || extras.some(other => other.id.split('-').at(-1) === account.id.split('-').at(-1))) continue;
    extras.push({ ...account, name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 50) : account.name });
  }
  return [...DEFAULT_ACCOUNTS, ...extras];
}
function addAccount(accounts, service, name) {
  const current = loadAccounts(accounts);
  if (current.length >= MAX_ACCOUNTS) throw new Error('Podés tener como máximo ocho cuentas de mensajería.');
  if (!['whatsapp', 'telegram'].includes(service)) throw new Error('Elegí WhatsApp o Telegram.');
  const slot = [7, 8].find(slot => !current.some(account => account.id.endsWith(`-extra-${slot}`)));
  const account = EXTRA_ACCOUNTS.find(account => account.service === service && account.id.endsWith(`-${slot}`));
  return [...current, { ...account, name: String(name || '').trim().slice(0, 50) || account.name }];
}
module.exports = { MAX_ACCOUNTS, DEFAULT_ACCOUNTS, ACCOUNT_CATALOG, serviceFor, loadAccounts, addAccount };
