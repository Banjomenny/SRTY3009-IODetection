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
    console.log(`[IO Detector] Fallback: found ${fallback.length} articles`)
    const validFallback = fallback.filter(looksLikePost)
    console.log(`[IO Detector] Fallback after filter: ${validFallback.length} valid posts`)
    return validFallback
}

function looksLikePost(element) {
    // Check aria-label for content
    const text = element.getAttribute('aria-label') || element.innerText || ''
    if (text.length < 20 || text.length > 5000) return false

    const tag = element.tagName.toLowerCase()
    if (['nav', 'header', 'footer', 'aside'].includes(tag)) return false

    
    if (element.querySelector('.io-detector-badge')) return false
    if (element.closest('.io-detector-badge')) return false

    return true
}

function extractText(postElement) {
    const config = getPlatformConfig()
    const selectors = config ? config.textSelectors : []

    for (const selector of selectors) {
        const el = postElement.querySelector(selector)
        if (el) {
            // Try aria-label first, then innerText
            let text = el.getAttribute('aria-label') || (el.innerText || '').trim()
            if (text && text.length >= 15) {
                return text.slice(0, 1000)
            }
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
