const API_URL = 'http://localhost:3000/pages'

const urlDisplay = document.getElementById('url-display')
const titleDisplay = document.getElementById('title-display')
const noteInput = document.getElementById('note')
const tagsInput = document.getElementById('tags')
const saveBtn = document.getElementById('save-btn')
const statusEl = document.getElementById('status')

let currentTab = null
let extractedContent = ''

function showStatus(msg, type) {
  statusEl.textContent = msg
  statusEl.className = `status ${type}`
}

function parseTags(raw) {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tab

  urlDisplay.textContent = tab.url || ''
  urlDisplay.title = tab.url || ''
  titleDisplay.textContent = tab.title || ''

  // Inject content script to extract page text
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        content: document.body ? document.body.innerText.slice(0, 50000) : '',
      }),
    })
    if (results?.[0]?.result) {
      extractedContent = results[0].result.content
      // Update title if content script got a better one
      if (results[0].result.title) {
        titleDisplay.textContent = results[0].result.title
      }
    }
  } catch (err) {
    // Content script injection may fail on chrome:// pages — that's fine
    console.warn('[ShadowCTX] Could not inject content script:', err.message)
  }
}

saveBtn.addEventListener('click', async () => {
  if (!currentTab) return

  saveBtn.disabled = true
  showStatus('Saving...', 'loading')

  const payload = {
    url: currentTab.url,
    title: currentTab.title,
    content: extractedContent || null,
    note: noteInput.value.trim() || null,
    tags: parseTags(tagsInput.value),
    source: 'extension',
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Server returned ${res.status}${body ? ': ' + body : ''}`)
    }

    showStatus('Saved!', 'success')
    saveBtn.textContent = 'Saved'
  } catch (err) {
    console.error('[ShadowCTX] Save failed:', err)
    showStatus(
      err.message.includes('Failed to fetch')
        ? 'Could not connect to local server (localhost:3000)'
        : err.message,
      'error'
    )
    saveBtn.disabled = false
  }
})

init()
