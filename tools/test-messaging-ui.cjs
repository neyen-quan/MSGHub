// Executed against the real packaged renderer in the disposable Windows QA profile.
module.exports = async function testMessagingUI(contents, seed) {
 return contents.executeJavaScript(`(async () => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const pause = () => new Promise(r => setTimeout(r, 180));
  if (${Boolean(seed)}) {
    const mode = document.querySelector('.work-mode-toggle');
    if (mode.getAttribute('aria-pressed') !== 'true') { mode.click(); await pause(); }
    for (const service of ['whatsapp', 'telegram']) {
      document.querySelector('.message-add-account').click(); await pause();
      const select = document.querySelector('#message-service');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, service);
      select.dispatchEvent(new Event('change', { bubbles: true })); await pause();
      document.querySelector('[aria-label="Agregar cuenta de mensajería"]').requestSubmit(); await pause();
    }
  }
  const accounts = JSON.parse(localStorage.getItem('msghub-messaging-accounts'));
  check(accounts.length === 8, 'Eight accounts must survive launch/restart');
  check(accounts[6].id === 'wa-extra-7' && accounts[7].id === 'telegram-extra-8', 'Service choice or stable ID changed');
  check(document.querySelectorAll('.messaging-chat-bar .ai-chat-tab').length === 8, 'Eight sub-tabs must render');
  check(document.querySelector('.message-add-account').disabled, 'Ninth account must be blocked');
  const muted = JSON.parse(localStorage.getItem('msghub-muted-messaging-apps'));
  check(accounts.every(a => muted.includes(a.id)), 'Added accounts must inherit active work mode');
  return { ok: true, accounts: accounts.length, serviceChoice: true, limit: true, workMode: true, persisted: !${Boolean(seed)} };
 })()`);
};
