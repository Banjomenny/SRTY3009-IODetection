const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000
let apiUrl = 'http://localhost:8000/classify'
let apiWarned = false
let scanCount = 0
let ioCount = 0
let totalNci = 0

console.log('[IO Detector] Initializing on', window.location.hostname)
console.log('[IO Detector] Platform config:', getPlatformConfig())

chrome.storage.local.get(['apiUrl'], (result) => {
    if (result.apiUrl) apiUrl = result.apiUrl + '/classify'
})

function hashText(text) {
    return text.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0).toString(36)
}

function scoreClass(score) {
    if (score <= 25) return 'io-score-low'
    if (score <= 50) return 'io-score-moderate'
    if (score <= 75) return 'io-score-strong'
    return 'io-score-overwhelming'
}

function scoreColor(score) {
    if (score <= 25) return '#16a34a'
    if (score <= 50) return '#ca8a04'
    if (score <= 75) return '#ea580c'
    return '#dc2626'
}

function createBadge(result) {
    const score = result.nci_score
    const isIO = result.label === 'IO'
    const icon = isIO ? '⚠️' : '✅'
    const color = scoreColor(score)
    const cls = scoreClass(score)
    const topNums = (result.top_indicators || []).map(n => `#${n}`).join(' ')

    const badge = document.createElement('div')
    badge.className = `io-detector-badge ${cls}`
    badge.setAttribute('data-score', score)

    const summary = document.createElement('span')
    summary.className = 'io-badge-summary'
    summary.textContent = `${icon} ${result.label} · NCI: ${score}/100${topNums ? ' · ' + topNums : ''}`
    summary.style.color = color

    const detail = document.createElement('div')
    detail.className = 'io-badge-detail'
    detail.style.display = 'none'

    const header = document.createElement('div')
    header.className = 'io-detail-header'
    header.textContent = `${result.tier} — ${result.label} (IO: ${result.io_confidence}, Org: ${result.org_confidence})`
    detail.appendChild(header)

    const indicators = result.indicators || []
    indicators.forEach(ind => {
        const row = document.createElement('div')
        row.className = 'io-indicator-row'

        const name = document.createElement('span')
        name.className = 'io-indicator-name'
        name.textContent = `#${ind.number} ${ind.name}`

        const bar = document.createElement('span')
        bar.className = 'io-indicator-bar'
        for (let i = 0; i < 5; i++) {
            const block = document.createElement('span')
            block.className = 'io-bar-block' + (i < ind.score ? ' io-bar-filled' : '')
            block.style.background = i < ind.score ? color : 'transparent'
            bar.appendChild(block)
        }

        const scoreEl = document.createElement('span')
        scoreEl.className = 'io-indicator-score'
        scoreEl.textContent = `${ind.score}/5`

        row.appendChild(name)
        row.appendChild(bar)
        row.appendChild(scoreEl)
        detail.appendChild(row)
    })

    if (indicators.length === 0) {
        const none = document.createElement('div')
        none.className = 'io-no-indicators'
        none.textContent = 'No indicators triggered'
        detail.appendChild(none)
    }

    badge.appendChild(summary)
    badge.appendChild(detail)

    badge.addEventListener('click', () => {
        detail.style.display = detail.style.display === 'none' ? 'block' : 'none'
    })

    return badge
}

async function processPost(postElement) {
    if (postElement.querySelector('.io-detector-badge')) return

    const text = extractText(postElement)
    if (!text || text.length < 15) return

    const key = hashText(text)
    const now = Date.now()
    const cached = cache.get(key)
    if (cached && now - cached.ts < CACHE_TTL) {
        appendBadge(postElement, cached.result)
        return
    }

    const platform = getPlatformConfig()?.name || window.location.hostname

    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { type: 'CLASSIFY', text, platform, apiUrl },
                resolve
            )
        })

        if (response && response.success) {
            cache.set(key, { result: response.data, ts: now })
            appendBadge(postElement, response.data)
            scanCount++
            if (response.data.label === 'IO') ioCount++
            totalNci += response.data.nci_score
        }
    } catch {
        if (!apiWarned) {
            console.warn('[IO Detector] Backend unreachable — badges disabled')
            apiWarned = true
        }
    }
}

function appendBadge(postElement, result) {
    if (postElement.querySelector('.io-detector-badge')) return
    const badge = createBadge(result)
    postElement.appendChild(badge)
}

function processPosts() {
    const posts = findPostElements()
    console.log('[IO Detector] Found', posts.length, 'posts') 
    posts.forEach(processPost)
}

let debounceTimer = null
const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(processPosts, 300)
})

observer.observe(document.body, { childList: true, subtree: true })
processPosts()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STATS') {
        const avg = scanCount > 0 ? Math.round(totalNci / scanCount) : 0
        sendResponse({ scanCount, ioCount, avgNci: avg })
    }
})
