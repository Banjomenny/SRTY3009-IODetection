const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000
let apiUrl = 'http://localhost:8000/classify'
let apiWarned = false
let scanCount = 0
let ioCount = 0
let totalNci = 0

const IND_NAMES = {
    1:  'Urgency framing',
    2:  'Emotional manipulation',
    3:  'Uniform messaging',
    4:  'Missing information',
    5:  'Simplistic narratives',
    6:  'Tribal division',
    7:  'Authority overload',
    8:  'Urgent action',
    9:  'Novelty',
    10: 'Financial gain',
    11: 'Suppression of dissent',
    12: 'False dilemmas',
    13: 'Bandwagon',
    14: 'Emotional repetition',
    15: 'Cherry picked data',
    16: 'Logical fallacies',
    17: 'Manufactured outrage',
    18: 'Framing techniques',
    19: 'Behavior shifts',
    20: 'Historical parallels',
}

chrome.storage.local.get(['apiUrl'], (result) => {
    if (result.apiUrl) apiUrl = result.apiUrl + '/classify'
})

function hashText(text) {
    if (typeof text !== 'string') {
        console.warn('[IO Detector] hashText received non-string:', typeof text, text)
        return null
    }
    return text.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0).toString(36)
}

function scoreClass(score) {
    if (score <= 25) return 'io-score-low'
    if (score <= 50) return 'io-score-moderate'
    if (score <= 75) return 'io-score-strong'
    return 'io-score-overwhelming'
}

// function scoreColor(score) {
//     if (score <= 25) return '#16a34a'
//     if (score <= 50) return '#ca8a04'
//     if (score <= 75) return '#ea580c'
//     return '#dc2626'
// }

function scoreColor(label) {
    if (label === 'IO') return '#facc15'
    return '#16a34a'
}

function createBadge(result) {
    const score = result.nci_score
    const isIO = result.label === 'IO'
    const icon = isIO ? '⚠️' : '✅'
    const color = scoreColor(result.label)
    const cls = scoreClass(score)
    const topNums = (result.top_indicators || []).map(n => `#${n}`).join(' ')

    const badge = document.createElement('div')
    badge.className = `io-detector-badge ${result.label.toLowerCase()}`
    badge.setAttribute('data-score', score)

    const summary = document.createElement('span')
    summary.className = 'io-badge-summary'
    summary.textContent =   `${icon} 
                            ${result.label} ·  ${result.label == 'IO' ? result.io_confidence * 100 + "%" : result.org_confidence * 100 + "%"} 
                            ${topNums ? '\n' + topNums : ''}`
    summary.style.color = color

    const detail = document.createElement('div')
    detail.className = 'io-badge-detail'
    detail.style.display = 'none'

    const header = document.createElement('div')
    header.className = 'io-detail-header'
    header.textContent = `${result.tier} — (IO: ${result.io_confidence}, Org: ${result.org_confidence})`
    detail.appendChild(header)

    const indicators = result.indicators || []

    if (indicators.length > 0) {
        const patternsHeader = document.createElement('div')
        patternsHeader.className = 'io-detail-header'
        patternsHeader.textContent = 'This post contains patterns commonly associated with:'
        detail.appendChild(patternsHeader)
    }

    indicators.forEach(ind => {
        const row = document.createElement('div')
        row.className = 'io-indicator-row'

        const name = document.createElement('span')
        name.className = 'io-indicator-name'
        name.textContent = `${ind.number} · ${IND_NAMES[ind.number]}`

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

   if (indicators.length > 0) {
        const disclaimer = document.createElement('span')
        disclaimer.className = 'io-indicator-disclaimer'
        disclaimer.textContent = 'Patterns detection is based on known words and phrases and may not reflect intent'
        detail.appendChild(disclaimer)
    }

    badge.appendChild(summary)
    badge.appendChild(detail)

    badge.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    detail.style.display = detail.style.display === 'none' ? 'block' : 'none'
})

    return badge
}

async function processPost(postElement) {
    if (postElement.querySelector('.io-detector-badge')) return

    const text = await extractText(postElement)
    if (!text || text.length < 15) return

    const key = hashText(text)
    if (!key) return
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
    debounceTimer = setTimeout(processPosts, 600)
})

observer.observe(document.body, { childList: true, subtree: true })
processPosts()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STATS') {
        const avg = scanCount > 0 ? Math.round(totalNci / scanCount) : 0
        sendResponse({ scanCount, ioCount, avgNci: avg })
    }
})
