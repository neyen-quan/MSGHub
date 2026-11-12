// Browser-level fallback: site-provided chat menus remain in charge when they
// prevent the default context menu. Enlarged media gets the missing native menu.
function mediaMenuTemplate(contents, params) {
  const items = [];
  if (params.mediaType === 'image' && params.hasImageContents) {
    items.push({ label: 'Copiar imagen', click: () => contents.copyImageAt(params.x, params.y) });
  }
  if (['image', 'video', 'audio'].includes(params.mediaType) && /^(https?:|blob:|data:)/i.test(params.srcURL || '')) {
    items.push({ label: 'Guardar archivo como…', click: () => contents.downloadURL(params.srcURL) });
  }
  if (params.isEditable) {
    if (items.length) items.push({ type: 'separator' });
    for (const [role, label, flag] of [['cut', 'Cortar', 'canCut'], ['copy', 'Copiar', 'canCopy'], ['paste', 'Pegar', 'canPaste'], ['selectAll', 'Seleccionar todo', 'canSelectAll']]) {
      items.push({ role, label, enabled: Boolean(params.editFlags?.[flag]) });
    }
  } else if (params.selectionText) items.push({ role: 'copy', label: 'Copiar texto' });
  if (/^https?:/i.test(params.linkURL || '')) {
    items.push({ label: 'Copiar enlace', click: () => require('electron').clipboard.writeText(params.linkURL) });
    items.push({ label: 'Guardar enlace como…', click: () => contents.downloadURL(params.linkURL) });
  }
  return items;
}
function registerMediaContextMenu(contents) {
  const { Menu, BrowserWindow } = require('electron');
  contents.on('context-menu', (event, params) => {
    const template = mediaMenuTemplate(contents, params);
    if (!template.length || contents.isDestroyed()) return;
    event.preventDefault();
    Menu.buildFromTemplate(template).popup({ window: BrowserWindow.getFocusedWindow(), frame: params.frame });
  });
}
module.exports = { mediaMenuTemplate, registerMediaContextMenu };
