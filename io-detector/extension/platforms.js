const PLATFORMS = {
    'x.com': {
        name: 'X / Twitter',
        postSelectors: [
            '[data-testid="tweet"]',
            '[data-testid="tweetDetail"]',
            'article'
        ],
        textSelectors: [
            '[data-testid="tweetText"]',
            '[lang]',
            'div[dir="auto"]'
        ]
    },
    'twitter.com': {
        name: 'X / Twitter',
        postSelectors: [
            '[data-testid="tweet"]',
            '[data-testid="tweetDetail"]',
            'article'
        ],
        textSelectors: [
            '[data-testid="tweetText"]',
            '[lang]',
            'div[dir="auto"]'
        ]
    },
    'truthsocial.com': {
        name: 'Truth Social',
        postSelectors: [
            '[data-testid="status"]',
            'article',
            '.status-wrapper'
        ],
        textSelectors: [
            '.status__content',
            '[class*="content__text"]',
            'p'
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
