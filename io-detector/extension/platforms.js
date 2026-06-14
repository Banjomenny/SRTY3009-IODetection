const PLATFORMS = {
    'x.com': {
    name: 'X / Twitter',
    postSelectors: [
        '[data-testid="tweet"]',
        'article'
    ],
    textSelectors: [
        'span'
    ]
},
    'truthsocial.com': {
    name: 'Truth Social',
    postSelectors: [
        'div[aria-label]'
    ],
    textSelectors: [
        'div[aria-label]'
    ]
},
    'reddit.com': {
        name: 'Reddit',
        postSelectors: [
            '[data-testid="post-container"]',
            'shreddit-post',
            'article'
        ],
        textSelectors: [
            '[data-testid="post-content"]',
            '.RichTextJSON-root',
            'p'
        ]
    }
}

function getPlatformConfig() {
    const host = window.location.hostname.replace('www.', '')
    return Object.entries(PLATFORMS)
        .find(([key]) => host.includes(key))?.[1] || null
}
