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
})
