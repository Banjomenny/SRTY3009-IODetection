const statusDot = document.getElementById('statusDot')
const statusText = document.getElementById('statusText')
const apiInput = document.getElementById('apiInput')
const saveBtn = document.getElementById('saveBtn')
const saveConfirm = document.getElementById('saveConfirm')

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

chrome.storage.local.get(['apiUrl'], (result) => {
    const base = result.apiUrl || 'http://localhost:8000'
    apiInput.value = base
    checkHealth(base)
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
