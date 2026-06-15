const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000
const FAIL_TTL = 30 * 1000
let apiUrl = 'http://localhost:8000/classify'
let apiWarned = false
let scanCount = 0
let ioCount = 0
let totalNci = 0
let settings = { enabled: true, ioOnly: false, minConfidence: 50, compactMode: false, profanityFilter: false }

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

chrome.storage.local.get(['apiUrl', 'enabled', 'ioOnly', 'minConfidence', 'compactMode', 'profanityFilter'], (result) => {
    if (result.apiUrl) apiUrl = result.apiUrl + '/classify'
    settings.enabled        = result.enabled !== false
    settings.ioOnly         = result.ioOnly === true
    settings.minConfidence  = result.minConfidence ?? 50
    settings.compactMode    = result.compactMode === true
    settings.profanityFilter = result.profanityFilter === true
    observer.observe(document.body, { childList: true, subtree: true })
    processPosts()
})

chrome.storage.onChanged.addListener((changes) => {
    if ('enabled'        in changes) settings.enabled        = changes.enabled.newValue
    if ('ioOnly'         in changes) settings.ioOnly         = changes.ioOnly.newValue
    if ('minConfidence'  in changes) settings.minConfidence  = changes.minConfidence.newValue
    if ('compactMode'    in changes) settings.compactMode    = changes.compactMode.newValue
    if ('profanityFilter' in changes) settings.profanityFilter = changes.profanityFilter.newValue
    applySettings()
})

function applySettings() {
    document.querySelectorAll('.io-detector-badge').forEach(badge => {
        const natural    = badge.classList.contains('natural')
        const confidence = parseInt(badge.dataset.ioConfidence || '0', 10)
        const belowThreshold = !natural && confidence < settings.minConfidence
        const hidden = !settings.enabled || (settings.ioOnly && natural) || belowThreshold
        badge.style.display = hidden ? 'none' : ''
        badge.classList.toggle('compact', settings.compactMode)
    })
    if (settings.enabled) processPosts()
}

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

function showAnalysisModal(postText, result, triggerBtn) {
    document.querySelector('.io-analysis-overlay')?.remove()

    if (triggerBtn) {
        triggerBtn.disabled = true
        triggerBtn.textContent = '⏳ Analyzing…'
    }

    const overlay = document.createElement('div')
    overlay.className = 'io-analysis-overlay'

    const modal = document.createElement('div')
    modal.className = 'io-analysis-modal'

    const header = document.createElement('div')
    header.className = 'io-analysis-header'

    const title = document.createElement('span')
    title.textContent = '⚠️ In-Depth Analysis'
    header.appendChild(title)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'io-analysis-close'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => overlay.remove())
    header.appendChild(closeBtn)

    const body = document.createElement('div')
    body.className = 'io-analysis-body'

    const loading = document.createElement('div')
    loading.className = 'io-analysis-loading'
    loading.textContent = 'Analyzing with Gemini…'
    body.appendChild(loading)

    modal.appendChild(header)
    modal.appendChild(body)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })

    chrome.runtime.sendMessage({
        type: 'GEMINI_ANALYZE',
        text: postText,
        apiUrl,
        io_confidence: result.io_confidence,
        nci_score: result.nci_score,
        tier: result.tier,
        indicators: result.indicators
    }, (response) => {
        if (triggerBtn) {
            triggerBtn.disabled = false
            triggerBtn.textContent = '🔍 Learn More'
        }
        body.innerHTML = ''
        if (response?.success && response.analysis) {
            const textEl = document.createElement('div')
            textEl.className = 'io-analysis-text'
            textEl.textContent = response.analysis
            body.appendChild(textEl)
        } else {
            const err = document.createElement('div')
            err.className = 'io-analysis-error'
            err.textContent = response?.error || 'Failed to get analysis. Make sure the backend is running and GEMINI_API_KEY is set.'
            body.appendChild(err)
        }
    })
}

const PROFANITY_PATTERN = typeof PROFANITY_LIST !== 'undefined' && PROFANITY_LIST.length > 0
    ? new RegExp(`(?<!\\w)(${PROFANITY_LIST.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?!\\w)`, 'gi')
    : null

function censorPost(postElement) {
    if (!settings.profanityFilter || !PROFANITY_PATTERN) return
    const walker = document.createTreeWalker(postElement, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (node.parentElement?.closest('.io-detector-badge')) return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
        }
    })
    let node
    while ((node = walker.nextNode())) {
        const censored = node.nodeValue.replace(PROFANITY_PATTERN, m => '*'.repeat(m.length))
        if (censored !== node.nodeValue) node.nodeValue = censored
    }
}

function createBadge(result, postText) {
    const score = result.nci_score
    const isIO = result.label === 'IO'
    const icon = isIO ? '⚠️' : '✅'
    const color = scoreColor(result.label)
    const topNums = (result.top_indicators || []).map(n => `#${n}`).join(' ')

    const badge = document.createElement('div')
    const displayLabel = isIO ? 'Flagged' : 'Natural'
    badge.className = `io-detector-badge ${displayLabel.toLowerCase()}`
    badge.setAttribute('data-score', score)
    badge.setAttribute('data-io-confidence', Math.round(result.io_confidence * 100))

    const summary = document.createElement('span')
    summary.className = 'io-badge-summary'
    summary.style.color = color

    const iconLabel = document.createElement('span')
    iconLabel.textContent = `${icon} ${displayLabel}`


    const confidenceSpan = document.createElement('span')
    confidenceSpan.className = 'io-badge-confidence'
    confidenceSpan.textContent = ` · ${isIO ? result.io_confidence * 100 : result.org_confidence * 100}%`

    summary.appendChild(iconLabel)
    summary.appendChild(confidenceSpan)

    if (topNums) {
        const indicatorsSpan = document.createElement('span')
        indicatorsSpan.className = 'io-badge-indicators'
        indicatorsSpan.textContent = ` ${topNums}`
        summary.appendChild(indicatorsSpan)
    }

    const detail = document.createElement('div')
    detail.className = 'io-badge-detail'
    detail.style.display = 'none'

    const header = document.createElement('div')
    header.className = 'io-detail-header'
    header.textContent = `${result.tier} — (Flagged: ${result.io_confidence}, Natural: ${result.org_confidence})`
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
        disclaimer.textContent = 'Pattern detection is based on known words and phrases and may not reflect intent'
        detail.appendChild(disclaimer)
    }

    if (isIO && postText) {
        const learnMoreBtn = document.createElement('button')
        learnMoreBtn.className = 'io-learn-more-btn'
        learnMoreBtn.textContent = '🔍 Learn More'
        learnMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            e.preventDefault()
            showAnalysisModal(postText, result, learnMoreBtn)
        })
        detail.appendChild(learnMoreBtn)
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
    if (!settings.enabled) return
    if (postElement.querySelector('.io-detector-badge')) return

    const text = await extractText(postElement)
    if (!text || text.length < 15) return

    const key = hashText(text)
    if (!key) return
    const now = Date.now()
    const cached = cache.get(key)
    if (cached) {
        if (cached._failed && now - cached.ts < FAIL_TTL) return
        if (!cached._failed && now - cached.ts < CACHE_TTL) {
            appendBadge(postElement, cached.result, cached.text)
            return
        }
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
            apiWarned = false
            cache.set(key, { result: response.data, ts: now, text })
            appendBadge(postElement, response.data, text)
            scanCount++
            if (response.data.label === 'IO') ioCount++
            totalNci += response.data.nci_score
        }
    } catch {
        cache.set(key, { _failed: true, ts: now })
        if (!apiWarned) {
            console.warn('[IO Detector] Backend unreachable — badges disabled')
            apiWarned = true
        }
    }
}

function appendBadge(postElement, result, text) {
    if (postElement.querySelector('.io-detector-badge')) return
    const badge = createBadge(result, text)
    const natural    = result.label !== 'IO'
    const confidence = Math.round(result.io_confidence * 100)
    const belowThreshold = !natural && confidence < settings.minConfidence
    if (!settings.enabled || (settings.ioOnly && natural) || belowThreshold) {
        badge.style.display = 'none'
    }
    if (settings.compactMode) badge.classList.add('compact')
    censorPost(postElement)
    postElement.appendChild(badge)
}

async function processArticle() {
    const article = document.querySelector('main article, article')
    if (!article) return
    if (article.querySelector('.io-detector-badge')) return

    const text = extractArticleText()
    if (!text || text.length < 100) return

    const key = hashText(text)
    if (!key) return
    const now = Date.now()
    const cached = cache.get(key)
    if (cached) {
        if (cached._failed && now - cached.ts < FAIL_TTL) return
        if (!cached._failed && now - cached.ts < CACHE_TTL) {
            prependArticleBadge(article, cached.result, cached.text)
            return
        }
    }

    const platform = window.location.hostname

    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { type: 'CLASSIFY', text, platform, apiUrl },
                resolve
            )
        })

        if (response?.success) {
            apiWarned = false
            cache.set(key, { result: response.data, ts: now, text })
            prependArticleBadge(article, response.data, text)
            scanCount++
            if (response.data.label === 'IO') ioCount++
            totalNci += response.data.nci_score
        }
    } catch {
        cache.set(key, { _failed: true, ts: now })
        if (!apiWarned) {
            console.warn('[IO Detector] Backend unreachable — badges disabled')
            apiWarned = true
        }
    }
}

function prependArticleBadge(articleElement, result, text) {
    if (articleElement.querySelector('.io-detector-badge')) return
    const badge = createBadge(result, text)
    badge.classList.add('io-article-badge')
    const natural    = result.label !== 'IO'
    const confidence = Math.round(result.io_confidence * 100)
    const belowThreshold = !natural && confidence < settings.minConfidence
    if (!settings.enabled || (settings.ioOnly && natural) || belowThreshold) {
        badge.style.display = 'none'
    }
    if (settings.compactMode) badge.classList.add('compact')
    censorPost(articleElement)
    articleElement.insertAdjacentElement('afterbegin', badge)
}

function processPosts() {
    const config = getPlatformConfig()
    if (config) {
        const posts = findPostElements()
        console.log('[IO Detector] Found', posts.length, 'posts')
        posts.forEach(processPost)
    } else if (document.querySelector('article')) {
        processArticle()
    }
}

let debounceTimer = null
const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(processPosts, 600)
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_STATS') {
        const avg = scanCount > 0 ? Math.round(totalNci / scanCount) : 0
        sendResponse({ scanCount, ioCount, avgNci: avg })
    }
})
