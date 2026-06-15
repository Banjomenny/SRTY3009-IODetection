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
    },
    'facebook.com': {
        name: 'Facebook',
        postSelectors: ['[role="article"]'],
        textSelectors: ['[data-ad-preview="message"]', '[data-testid="post_message"]']
    },
    'linkedin.com': {
        name: 'LinkedIn',
        postSelectors: ['[data-urn^="urn:li:activity"]', '.feed-shared-update-v2'],
        textSelectors: ['.feed-shared-text__text-view', '.feed-shared-text', '.update-components-text']
    }
}

function getPlatformConfig() {
    const host = window.location.hostname.replace('www.', '')
    return Object.entries(PLATFORMS)
        .find(([key]) => host.includes(key))?.[1] || null
}
