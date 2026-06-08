function findPostElements() {
    const config = getPlatformConfig()
    const selectors = config ? config.postSelectors : []

    for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector))
        const filtered = elements.filter(looksLikePost)
        if (filtered.length > 0) return filtered
    }

    // Fallback
    const fallback = Array.from(document.querySelectorAll('article, [role="article"]'))
    return fallback.filter(looksLikePost)
}

function looksLikePost(element) {
    const text = element.innerText || ''
    if (text.length < 20 || text.length > 5000) return false

    const tag = element.tagName.toLowerCase()
    if (['nav', 'header', 'footer', 'aside'].includes(tag)) return false

    if (element.children.length < 2) return false

    // Skip if already badged or nested inside a badged element
    if (element.querySelector('.io-detector-badge')) return false
    if (element.closest('.io-detector-badge')) return false

    return true
}

function extractText(postElement) {
    const config = getPlatformConfig()
    const selectors = config ? config.textSelectors : []

    for (const selector of selectors) {
        const el = postElement.querySelector(selector)
        if (el && el.innerText && el.innerText.trim().length >= 15) {
            return el.innerText.trim().slice(0, 1000)
        }
    }

    return extractMainText(postElement)
}

function extractMainText(element) {
    const raw = element.innerText || ''
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

    const UI_WORDS = new Set([
        'like', 'retweet', 'reply', 'share', 'follow', 'following',
        'followers', 'likes', 'retweets', 'replies', 'views', 'quote',
        'bookmark', 'bookmarks', 'comment', 'comments', 'upvote', 'downvote',
        'save', 'report', 'more', 'show', 'hide'
    ])

    const filtered = lines.filter(line => {
        if (/^\d+$/.test(line)) return false
        if (/^\d+[smhd]\s*(ago)?$/.test(line)) return false
        if (UI_WORDS.has(line.toLowerCase())) return false
        if (/^@\w+$/.test(line)) return false
        if (line.length < 30 && line === line.toUpperCase()) return false
        return true
    })

    if (filtered.length === 0) return ''
    const longest = filtered.reduce((a, b) => (b.length > a.length ? b : a), '')
    return longest.slice(0, 1000)
}
