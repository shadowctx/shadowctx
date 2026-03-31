// ShadowCTX content script — extracts page content for the popup
;(function () {
  // Attempt to use Mozilla Readability for clean article extraction.
  // Falls back to document.body.innerText if Readability is not available.
  function extractContent() {
    try {
      if (typeof Readability !== 'undefined') {
        const documentClone = document.cloneNode(true)
        const article = new Readability(documentClone).parse()
        if (article) {
          return {
            title: article.title || document.title,
            content: article.textContent || document.body.innerText,
          }
        }
      }
    } catch (_) {
      // Fall through to basic extraction
    }
    return {
      title: document.title,
      content: document.body ? document.body.innerText.slice(0, 50000) : '',
    }
  }

  const result = extractContent()
  // Return via message to popup
  chrome.runtime.sendMessage({ type: 'PAGE_CONTENT', payload: result })
})()
