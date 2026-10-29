// Telegram Web K's bundled alert assets only. Voice notes, videos, calls and
// user-uploaded files (including a file named notification.mp3) are untouched.
function installNotificationAudioGuard(initialEnabled) {
  if (window.__msgHubNotificationAudio) return;
  const storageKey = 'msghub-alert-audio-v104';
  let enabled = initialEnabled;
  try { const saved = localStorage.getItem(storageKey); if (saved !== null) enabled = saved === 'true'; } catch {}
  const byteSources = new WeakSet(), buffers = new WeakSet(), blobs = new WeakSet();
  const objectURLs = new Set(), activeNodes = new Set(), activeMedia = new Set();
  const isAlertURL = value => {
    if (objectURLs.has(String(value))) return true;
    try {
      const url = new URL(String(value), location.href);
      return url.origin === 'https://web.telegram.org' && /^\/k\/assets\/audio\/(notification|call_incoming)\.mp3$/.test(url.pathname);
    } catch { return false; }
  };
  const isAlertMedia = media => !media.srcObject && (isAlertURL(media.currentSrc) || isAlertURL(media.src) || [...media.querySelectorAll('source')].some(s => isAlertURL(s.src)));
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...args) {
    if (isAlertMedia(this)) {
      if (enabled) return Promise.resolve();
      activeMedia.add(this);
      this.addEventListener('ended', () => activeMedia.delete(this), { once:true });
    }
    return Reflect.apply(play, this, args);
  };
  document.addEventListener('play', event => {
    const media = event.target;
    if (media instanceof HTMLMediaElement && isAlertMedia(media)) {
      if (enabled) media.pause(); else activeMedia.add(media);
    }
  }, true);
  // Track origin before decoding: Web Audio notification players may use the
  // same AudioContext as other media. Only buffers from the two assets count.
  for (const method of ['arrayBuffer','blob']) {
    const original = Response.prototype[method];
    Response.prototype[method] = async function(...args) {
      const result = await Reflect.apply(original, this, args);
      if (isAlertURL(this.url)) (method === 'blob' ? blobs : byteSources).add(result);
      return result;
    };
  }
  if (Blob.prototype.arrayBuffer) {
    const original = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function(...args) {
      const result = await Reflect.apply(original, this, args);
      if (blobs.has(this)) byteSources.add(result);
      return result;
    };
  }
  const createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
  URL.createObjectURL = function(blob) {
    const url = Reflect.apply(createURL, this, [blob]);
    if (blobs.has(blob)) objectURLs.add(url);
    return url;
  };
  URL.revokeObjectURL = function(url) { objectURLs.delete(url); return Reflect.apply(revokeURL, this, [url]); };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(...args) {
    const requested = args[1];
    this.addEventListener('load', () => {
      if (isAlertURL(this.responseURL || requested)) {
        if (this.responseType === 'arraybuffer' && this.response) byteSources.add(this.response);
        if (this.responseType === 'blob' && this.response) blobs.add(this.response);
      }
    }, { once:true, capture:true });
    return Reflect.apply(open, this, args);
  };
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function(data, success, failure) {
    const alert = byteSources.has(data);
    const mark = buffer => { if (alert) buffers.add(buffer); return buffer; };
    const promise = Reflect.apply(decode, this, [data, typeof success === 'function' ? buffer => success(mark(buffer)) : undefined, failure]);
    return promise.then(mark);
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function(...args) {
    if (buffers.has(this.buffer)) {
      if (enabled) return;
      activeNodes.add(this);
      this.addEventListener('ended', () => activeNodes.delete(this), { once:true });
    }
    return Reflect.apply(start, this, args);
  };
  window.__msgHubNotificationAudio = {
    version: '1.0.4',
    setEnabled(value) {
      enabled = Boolean(value);
      try { localStorage.setItem(storageKey, String(enabled)); } catch {}
      if (enabled) {
        for (const node of activeNodes) { try { node.stop(); } catch {} }
        for (const media of activeMedia) if (isAlertMedia(media)) media.pause();
        activeNodes.clear(); activeMedia.clear();
      }
      return { ok:true, enabled, method:'notification-assets' };
    }
  };
}
module.exports = { installNotificationAudioGuard };
