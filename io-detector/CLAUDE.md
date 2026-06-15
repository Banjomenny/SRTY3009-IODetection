# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IO Detector is a two-part system for detecting information operations (IO) / propaganda in social media posts:
- **`backend/`** — Python FastAPI server that classifies text using a HuggingFace BERT model and optional Gemini AI
- **`extension/`** — Manifest V3 Chrome extension that scrapes posts from social platforms and annotates them with classification badges

## Running the Backend

```bash
cd backend

# Set optional Gemini key (enables /analyze endpoint)
$env:GEMINI_API_KEY = "your-key-here"   # PowerShell
# export GEMINI_API_KEY=your-key-here   # bash

pip install -r requirements.txt
python main.py
# Backend listens on http://localhost:8000
```

The model (`Banjomenny/DisInfoBert-Defended`) is downloaded from HuggingFace on first startup (~300 MB). Startup takes 10–30 seconds. Check `/health` to confirm ready state.

## Loading the Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. The popup defaults to `http://localhost:8000` — change this in the popup if the backend runs elsewhere

## Backend Architecture

**`main.py`** — two classification endpoints:
- `POST /classify` — runs the HuggingFace model (returns `label`, `io_confidence`, `org_confidence`) plus NCI keyword scoring (returns `nci_score`, `indicators`). Appends each result to a per-platform CSV log (`classification_log_{platform}_{date}.csv`).
- `POST /analyze` — calls Gemini `gemini-2.5-flash` to generate a 1–3 paragraph narrative analysis of a flagged post. Requires `GEMINI_API_KEY` env var.
- `GET /health` — returns device and model info.

**`nci_scorer.py`** — pure keyword matching across 20 NCI (Narrative Coordination Indicator) categories. Each indicator scores 0–5 based on keyword hit count; the total is normalised to a 0–100 NCI score. Indicator 14 (EmotionalRepetition) counts emotional words appearing ≥3 times rather than unique hits.

Text is pre-cleaned in `main.py::clean_text()` before both model inference and NCI scoring: strips URLs, @-mentions, collapses whitespace, truncates at 512 chars.

## Extension Architecture

**Message flow:** `content.js` → `chrome.runtime.sendMessage` → `background.js` → `fetch(backend)` → response back to `content.js`

Content scripts run in the page context and cannot make cross-origin fetch calls directly — all HTTP requests go through `background.js` (the service worker).

**`platforms.js`** — maps hostnames to CSS selectors for locating post containers and extracting text. Add new platforms here.

**`extractor.js`** — `findPostElements()` tries platform selectors then falls back to `article`/`[role="article"]`. `extractText()` tries platform text selectors then falls back to `extractMainText()`, which filters out UI chrome (like/retweet counts, timestamps). Handles Twitter's "Show more" truncation by clicking the expand button and waiting for DOM update.

**`content.js`** — orchestrates scanning:
- 5-minute in-memory `cache` keyed by a hash of post text (avoids re-classifying the same post)
- `MutationObserver` with 600 ms debounce re-runs `processPosts()` as new content loads
- `createBadge()` builds the inline badge DOM; click toggles the detail panel
- Settings (`enabled`, `ioOnly`, `minConfidence`, `compactMode`) are read from `chrome.storage.local` and live-updated via `onChanged`
- Stats (scan count, IO count, avg NCI) are maintained in module-level vars and returned on `GET_STATS` message

**`popup.js`** — reads `chrome.storage.local`, pings `/health`, displays stats by messaging the active tab's content script, and persists setting changes immediately to storage (content script picks them up via `onChanged`).

## Key Constraints

- The HuggingFace model uses `max_length=128` tokens even though `clean_text` truncates at 512 chars — this is intentional (model was trained at 128).
- CSV logs are written relative to the working directory where `python main.py` is run, which is `backend/`.
- The NCI scoring is purely lexical (no ML); it can false-positive on aggressive language that isn't coordinated manipulation. The Gemini prompt explicitly accounts for this.
- `looksLikePost()` in `extractor.js` rejects elements shorter than 20 chars or longer than 15,000 chars, and skips nav/header/footer/aside tags.
