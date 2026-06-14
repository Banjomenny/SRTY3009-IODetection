chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLASSIFY') {
        fetch(message.apiUrl || 'http://localhost:8000/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: message.text,
                platform: message.platform
            })
        })
        .then(r => r.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(() => sendResponse({ success: false }))

        return true
    }

    if (message.type === 'GEMINI_ANALYZE') {
        const baseUrl = (message.apiUrl || 'http://localhost:8000/classify').replace('/classify', '')
        fetch(`${baseUrl}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: message.text,
                io_confidence: message.io_confidence,
                nci_score: message.nci_score,
                tier: message.tier,
                indicators: message.indicators
            })
        })
        .then(r => r.json())
        .then(data => sendResponse({ success: !data.error, analysis: data.analysis, error: data.error }))
        .catch(() => sendResponse({ success: false, error: 'Backend unreachable' }))

        return true
    }
})
