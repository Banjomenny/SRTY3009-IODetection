const statusDot = document.getElementById('statusDot')
const statusText = document.getElementById('statusText')
const apiInput = document.getElementById('apiInput')
const saveBtn = document.getElementById('saveBtn')
const saveConfirm = document.getElementById('saveConfirm')
const toggleEnabled    = document.getElementById('toggleEnabled')
const toggleIoOnly     = document.getElementById('toggleIoOnly')
const toggleCompact    = document.getElementById('toggleCompact')
const toggleProfanity  = document.getElementById('toggleProfanity')
const confidenceSlider = document.getElementById('confidenceSlider')
const thresholdValue   = document.getElementById('thresholdValue')

async function checkHealth(base) {
    try {
        const r = await fetch(base + '/health', { method: 'GET' })
        if (r.ok) {
            const data = await r.json()
            setStatus('online', `Connected · ${data.device}`)
        } else {
            setStatus('offline', 'Backend error')
        }
    } catch {
        setStatus('offline', 'Backend offline')
    }
}

function setStatus(state, text) {
    statusDot.className = 'status-dot ' + state
    statusText.textContent = text
}

function loadStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATS' }, (res) => {
            if (chrome.runtime.lastError || !res) return
            document.getElementById('statScanned').textContent = res.scanCount
            document.getElementById('statIO').textContent = res.ioCount
            document.getElementById('statAvg').textContent = res.avgNci
        })
    })
}

chrome.storage.local.get(['apiUrl', 'enabled', 'ioOnly', 'minConfidence', 'compactMode', 'profanityFilter'], (result) => {
    const base = result.apiUrl || 'http://localhost:8000'
    apiInput.value = base
    checkHealth(base)
    toggleEnabled.checked   = result.enabled !== false
    toggleIoOnly.checked    = result.ioOnly === true
    toggleCompact.checked   = result.compactMode === true
    toggleProfanity.checked = result.profanityFilter === true
    const thresh = result.minConfidence ?? 50
    confidenceSlider.value = thresh
    thresholdValue.textContent = thresh + '%'
})

toggleEnabled.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: toggleEnabled.checked })
})

toggleIoOnly.addEventListener('change', () => {
    chrome.storage.local.set({ ioOnly: toggleIoOnly.checked })
})

toggleCompact.addEventListener('change', () => {
    chrome.storage.local.set({ compactMode: toggleCompact.checked })
})

toggleProfanity.addEventListener('change', () => {
    chrome.storage.local.set({ profanityFilter: toggleProfanity.checked })
})

confidenceSlider.addEventListener('input', () => {
    const val = parseInt(confidenceSlider.value, 10)
    thresholdValue.textContent = val + '%'
    chrome.storage.local.set({ minConfidence: val })
})

saveBtn.addEventListener('click', () => {
    const base = apiInput.value.trim().replace(/\/$/, '')
    chrome.storage.local.set({ apiUrl: base }, () => {
        saveConfirm.textContent = 'Saved!'
        setTimeout(() => { saveConfirm.textContent = '' }, 2000)
        checkHealth(base)
    })
})

loadStats()
