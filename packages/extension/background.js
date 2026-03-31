// ShadowCTX service worker — minimal, keeps extension alive
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ShadowCTX] Extension installed')
})
