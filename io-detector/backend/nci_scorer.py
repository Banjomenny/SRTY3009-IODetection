import re
from collections import Counter

NCI_INDICATORS = {
    1:  ('Timing',                ['breaking', 'urgent', 'just in', 'developing']),
    2:  ('EmotionalManipulation', ['destroy', 'threat', 'danger', 'crisis', 'attack',
                                   'corrupt', 'evil', 'disaster', 'terrifying', 
                                   'ultra-violent', 'savage', 'animals', 'they want you dead',
                                   'silence us', 'hunt them down']),
    3:  ('UniformMessaging',      ['fake news', 'witch hunt', 'rigged', 'deep state',
                                   'radical left', 'mainstream media', 'lamestream', 
                                   'plandemic', 'scamdemic', 'globalist agenda', 'new world order', 
                                   'great reset', 'woke agenda', 'groomer', 'regime media']),
    4:  ('MissingInformation',    ['they wont tell you', 'media ignores', 'suppressed',
                                   'censored', 'hidden', 'what they dont want']),
    5:  ('SimplisticNarratives',  ['good vs evil', 'us vs them', 'real americans',
                                   'true patriots', 'the enemy', 'true believers', 
                                   'real people', 'ordinary people vs', 'working people vs', 'them vs us']),
    6:  ('TribalDivision',        ['illegals', 'invasion', 'replacement', 'globalist',
                                   'elites', 'they are coming', 'our country', 'our people', 
                                   'they are replacing', 'enough is enough', 'take back', 
                                   'our streets', 'protect our', 'defend our']),
    7:  ('AuthorityOverload',     ['experts say', 'scientists agree', 'studies show',
                                   'sources confirm', 'insiders reveal']),
    8:  ('UrgentAction',          ['share now', 'share before', 'deleted', 'must see',
                                   'wake up', 'act now', 'do something', 'immediately']),
    9:  ('Novelty',               ['unprecedented', 'never before', 'shocking', 'explosive',
                                   'bombshell', 'unbelievable', 'you wont believe', 'leaked', 
                                   'just leaked', 'they dont want you to see this', 'watch before deleted']),
    10: ('FinancialGain',         ['follow the money', 'cui bono', 'who profits',
                                   'they benefit', 'billionaires', 'george soros']),
    11: ('SuppressionDissent',    ['silenced', 'banned', 'cancelled', 'deplatformed',
                                   'censored', 'they dont want you to know']),
    12: ('FalseDilemmas',         ['either you', 'if you dont', 'only two choices',
                                   'with us or against', 'no other option']),
    13: ('Bandwagon',             ['everyone knows', 'everybody agrees', 'millions believe',
                                   'the whole country', 'nobody trusts']),
    15: ('CherryPickedData',      ['statistics show', 'according to polls', 'studies prove',
                                   'the numbers dont lie', 'data confirms']),
    16: ('LogicalFallacies',      ['if you believe', 'that means you', 'so you support',
                                   'typical liberal', 'typical conservative']),
    17: ('ManufacturedOutrage',   ['outrageous', 'disgrace', 'disgusting', 'shameful',
                                   'unacceptable', 'how dare', 'i am furious']),
    18: ('FramingTechniques',     ['so-called', 'alleged', 'what they call', 'the so called',
                                   'quote unquote', 'their version of']),
    19: ('BehaviorShifts',        ['join the movement', 'take to the streets', 'rise up',
                                   'revolution', 'enough is enough', 'time to act', 
                                   'follow us', 'share this', 'spread the word', 'pass it on',
                                   'let them know', 'make them hear']),
    20: ('HistoricalParallels',   ['just like hitler', 'communist takeover', 'like the ussr',
                                   'history repeating', 'this is how it starts'])
}

EMOTIONAL_WORDS = set(
    NCI_INDICATORS[2][1] + NCI_INDICATORS[6][1] + NCI_INDICATORS[8][1]
)

def score_text(text: str) -> dict:
    lower = text.lower()
    scores = {}

    for num, (name, keywords) in NCI_INDICATORS.items():
        hits = sum(1 for kw in keywords if kw in lower)
        scores[num] = min(hits, 5)

    # Indicator 14 — EmotionalRepetition
    words = re.findall(r'\b\w+\b', lower)
    word_counts = Counter(words)
    repeated_emotional = sum(
        1 for w in EMOTIONAL_WORDS
        if len(w.split()) == 1 and word_counts.get(w, 0) >= 3
    )
    scores[14] = min(repeated_emotional, 5)

    triggered = [
        {'name': NCI_INDICATORS[n][0] if n != 14 else 'EmotionalRepetition',
         'number': n,
         'score': s}
        for n, s in scores.items()
        if s > 0
    ]
    triggered.sort(key=lambda x: x['score'], reverse=True)

    total_raw = sum(scores.values())
    max_possible = len(scores) * 5
    nci_score = round((total_raw / max_possible) * 100)

    top_indicators = [ind['number'] for ind in triggered[:3]]

    return {
        'nci_score': nci_score,
        'indicators': triggered,
        'top_indicators': top_indicators,
    }


def get_tier(io_confidence: float, label: str) -> str:
    if io_confidence >= 0.9:
        return f'High likelihood of {label}'
    elif io_confidence >= 0.75:
        return f'Moderate likelihood of {label}'
    elif io_confidence >= 0.5:
        return f'Low likelihood of {label}'
    else:
        return f'Low likelihood of {label}'
