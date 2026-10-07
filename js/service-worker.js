chrome.runtime.onInstalled.addListener(function () {
  ensureContextMenus();
});

function ensureContextMenus() {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({ id: 'save-current-to-workspace', title: 'Save to Glass New Tab', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'save-link-to-workspace', title: 'Save link to Glass New Tab', contexts: ['link'] });
  });
}

chrome.runtime.onStartup.addListener(ensureContextMenus);

function openQuickSavePopup(tab) {
  if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) return;
  chrome.storage.local.set({ quickSaveDraft: { url: tab.url, title: tab.title || tab.url, favIconUrl: tab.favIconUrl || '' } }, function () {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html#quick-save'), active: true });
  });
}

chrome.action.onClicked.addListener(function (tab) {
  openQuickSavePopup(tab);
});

chrome.commands.onCommand.addListener(function (command) {
  if (command !== 'quick-save-current-tab') return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) { if (tabs && tabs[0]) openQuickSavePopup(tabs[0]); });
});

chrome.runtime.onMessage.addListener(function (message, sender) {
  if (message && message.type === 'GLASS_CLOSE_QUICK_SAVE_TAB' && sender.tab && sender.tab.id !== undefined) {
    chrome.tabs.remove(sender.tab.id);
  }
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (!tab) return;
  if (info.menuItemId === 'save-link-to-workspace') openQuickSavePopup({ url: info.linkUrl, title: info.linkUrl });
  else if (info.menuItemId === 'save-current-to-workspace') openQuickSavePopup(tab);
});