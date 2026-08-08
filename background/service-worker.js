// TubeMark — Background Service Worker (Phase 0)
//
// In future phases, this background script will handle:
// - Bookmark creation, updates, and synchronization tasks
// - Browser action icon changes
// - Cross-context event message forwarding

chrome.runtime.onInstalled.addListener(() => {
  console.log('TubeMark Extension background worker successfully installed (Phase 0).');
});
