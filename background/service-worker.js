/**
 * TubeMark Background Service Worker
 *
 * Phase 0: Minimal installation listener.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.log('TubeMark Extension successfully installed (Phase 0).');
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.log('TubeMark Extension successfully updated to v' + chrome.runtime.getManifest().version);
  }
});
