function installSidebar(service) {
    if (window.__workhubWhatsAppResizeV2) return;
    window.__workhubWhatsAppResizeV2 = true;
    const key = 'workhub-wa-sidebar-width-v2-' + service;
    let sidebar = null;
    let mainPane = null;
    let grip = null;
    let queued = false;
    let dragging = false;
    let dragStartX = 0;
    let dragStartWidth = 0;

    function findColumns() {
      const side = document.querySelector('#side');
      const main = document.querySelector('#main');
      if (!side || !main) return null;
      let container = side.parentElement;
      for (let i = 0; container && i < 24 && !container.contains(main); i++) container = container.parentElement;
      if (!container) return null;
      let sideBranch = side;
      let mainBranch = main;
      while (sideBranch.parentElement !== container && sideBranch.parentElement) sideBranch = sideBranch.parentElement;
      while (mainBranch.parentElement !== container && mainBranch.parentElement) mainBranch = mainBranch.parentElement;
      if (!container || sideBranch === mainBranch) return null;
      const a = side.getBoundingClientRect();
      const b = main.getBoundingClientRect();
      const p = container.getBoundingClientRect();
      if (Math.abs(a.top - b.top) > 80 || Math.min(a.height, b.height) < innerHeight * .45 || p.width < innerWidth * .55) return null;
      return {side, main, sideBranch, mainBranch, container};
    }

    function setHorizontalLayout(width) {
      const cols = findColumns();
      if (!cols) return false;
      sidebar = cols.side;
      mainPane = cols.main;
      const sidebarRect = sidebar.getBoundingClientRect();
      const branchRect = cols.sideBranch.getBoundingClientRect();
      const leftRailWidth = Math.max(0, sidebarRect.left - branchRect.left);
      const sideColumnWidth = Math.round(leftRailWidth + width);
      cols.container.style.setProperty('display', 'flex', 'important');
      cols.container.style.setProperty('flex-direction', 'row', 'important');
      cols.container.style.setProperty('flex-wrap', 'nowrap', 'important');
      cols.container.style.setProperty('width', '100%', 'important');
      cols.container.style.setProperty('min-width', '0', 'important');
      cols.sideBranch.style.setProperty('box-sizing', 'border-box', 'important');
      cols.sideBranch.style.setProperty('width', sideColumnWidth + 'px', 'important');
      cols.sideBranch.style.setProperty('min-width', sideColumnWidth + 'px', 'important');
      cols.sideBranch.style.setProperty('max-width', sideColumnWidth + 'px', 'important');
      cols.sideBranch.style.setProperty('flex', '0 0 ' + sideColumnWidth + 'px', 'important');
      sidebar.style.setProperty('width', width + 'px', 'important');
      sidebar.style.setProperty('min-width', width + 'px', 'important');
      sidebar.style.setProperty('max-width', width + 'px', 'important');
      cols.mainBranch.style.setProperty('box-sizing', 'border-box', 'important');
      cols.mainBranch.style.setProperty('width', '0', 'important');
      cols.mainBranch.style.setProperty('min-width', '0', 'important');
      cols.mainBranch.style.setProperty('flex', '1 1 0%', 'important');
      mainPane.style.setProperty('width', '100%', 'important');
      mainPane.style.setProperty('min-width', '0', 'important');
      localStorage.setItem(key, String(Math.round(width)));
      updateGrip();
      return true;
    }

    function clampWidth(width) {
      const max = Math.max(260, Math.min(520, innerWidth * .58));
      return Math.round(Math.min(max, Math.max(220, width)));
    }

    function updateGrip() {
      if (!grip?.isConnected) return;
      if (!sidebar?.isConnected) { grip.style.display = 'none'; endDrag(); return; }
      const rect = sidebar.getBoundingClientRect();
      // Ignore our own handle when checking whether a media viewer covers the list.
      grip.style.pointerEvents = 'none';
      const top = document.elementFromPoint(Math.max(0, rect.right - 12), Math.max(0, rect.top + rect.height / 2));
      const available = rect.width > 0 && rect.height > 0 && top && sidebar.contains(top);
      grip.style.display = available ? 'block' : 'none';
      grip.style.pointerEvents = available ? 'auto' : 'none';
      if (!available) endDrag();
      grip.style.left = (rect.right - 5) + 'px';
      grip.style.top = Math.max(0, rect.top) + 'px';
      grip.style.height = Math.max(120, Math.min(innerHeight - Math.max(0, rect.top), rect.height)) + 'px';
    }

    function startDrag(event) {
      updateGrip();
      if (event.button !== 0 || !sidebar?.isConnected || grip.style.display === 'none') return;
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      dragStartX = event.clientX;
      dragStartWidth = sidebar.getBoundingClientRect().width;
      grip.style.background = 'transparent';
      document.body.style.setProperty('cursor', 'col-resize', 'important');
      document.body.style.setProperty('user-select', 'none', 'important');
      grip.setPointerCapture?.(event.pointerId);
    }

    function moveDrag(event) {
      if (!dragging) return;
      setHorizontalLayout(clampWidth(dragStartWidth + event.clientX - dragStartX));
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (grip?.isConnected) grip.style.background = 'transparent';
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    }

    function ensureGrip() {
      const cols = findColumns();
      if (!cols || !document.body) { if (grip) grip.style.display = 'none'; endDrag(); return; }
      const changed = sidebar !== cols.side;
      sidebar = cols.side;
      mainPane = cols.main;
      if (!grip?.isConnected) {
        grip = document.createElement('div');
        grip.id = 'workhub-wa-sidebar-resizer-v2';
        grip.title = 'Arrastrá horizontalmente para ajustar el ancho de la lista';
        grip.style.cssText = 'position:fixed;z-index:2147483647;width:11px;cursor:col-resize;background:transparent;border:0;box-shadow:none;touch-action:none;';
        grip.addEventListener('pointerdown', startDrag);
        grip.addEventListener('pointermove', moveDrag);
        grip.addEventListener('pointerup', endDrag);
        grip.addEventListener('pointercancel', endDrag);
        document.body.appendChild(grip);
      }
      if (changed) {
        const saved = Number(localStorage.getItem(key));
        if (saved >= 220) setHorizontalLayout(clampWidth(saved));
      }
      updateGrip();
    }

    function queueEnsure() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; ensureGrip(); });
    }

    document.addEventListener('pointermove', moveDrag, true);
    document.addEventListener('pointerup', endDrag, true);
    window.addEventListener('resize', queueEnsure);
    window.addEventListener('scroll', updateGrip, true);
    new MutationObserver(queueEnsure).observe(document.documentElement, {childList:true,subtree:true});
    queueEnsure();
    setTimeout(queueEnsure, 500);
    setTimeout(queueEnsure, 1800);
    setInterval(updateGrip, 250);
  }
module.exports = { installSidebar };
