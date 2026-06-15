from contextlib import asynccontextmanager
from datetime import datetime
import csv
import os
import re
import torch
from google import genai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from nci_scorer import score_text, get_tier


MODEL_NAME = "Banjomenny/DisInfoBert-Defended"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

INDICATOR_NAMES = {
    1: 'Urgency framing', 2: 'Emotional manipulation', 3: 'Uniform messaging',
    4: 'Missing information', 5: 'Simplistic narratives', 6: 'Tribal division',
    7: 'Authority overload', 8: 'Urgent action', 9: 'Novelty', 10: 'Financial gain',
    11: 'Suppression of dissent', 12: 'False dilemmas', 13: 'Bandwagon',
    14: 'Emotional repetition', 15: 'Cherry picked data', 16: 'Logical fallacies',
    17: 'Manufactured outrage', 18: 'Framing techniques', 19: 'Behavior shifts',
    20: 'Historical parallels',
}

tokenizer = None
model = None
device = None
gemini_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer, model, device, gemini_client
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[IO Detector] Loading {MODEL_NAME} on {device}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME).to(device)
    model.eval()
    print(f"[IO Detector] Model ready on {device}")
    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[IO Detector] Gemini client ready")
    else:
        print("[IO Detector] No GEMINI_API_KEY set — /analyze endpoint disabled")
    yield


app = FastAPI(title="IO Detector API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ClassifyRequest(BaseModel):
    text: str
    platform: str = "unknown"


def clean_text(text: str) -> str:
    text = re.sub(r'http\S+|www\.\S+', '', text)
    text = re.sub(r'@\w+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:512]


@app.post("/classify")
async def classify(req: ClassifyRequest):
    cleaned = clean_text(req.text)

    inputs = tokenizer(
        cleaned,
        max_length=128,
        truncation=True,
        padding=True,
        return_tensors="pt"
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1)[0].cpu().tolist()

    org_conf = round(probs[0], 3)
    io_conf = round(probs[1], 3)
    label = "IO" if io_conf >= 0.5 else "Organic"

    nci = score_text(cleaned)

    safe_platform = re.sub(r'[^\w]', '_', req.platform)
    log_path = f"classification_log_{safe_platform}_{datetime.now().strftime('%Y-%m-%d')}.csv"

    write_header = not os.path.exists(log_path)

    with open(log_path, "a", newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        if write_header:
            writer.writerow(['text', 'label', 'io_confidence', 'org_confidence', 
                            'nci_score', 'top_indicators', 'platform', 'timestamp'])

        writer.writerow([
            cleaned,
            label,
            io_conf,
            org_conf,
            nci["nci_score"],
            ','.join(str(n) for n in nci["top_indicators"]),
            req.platform,
            datetime.now().isoformat()
        ])
    
    return {
        "label": label,
        "io_confidence": io_conf,
        "org_confidence": org_conf,
        "nci_score": nci["nci_score"],
        "tier": get_tier(io_conf, label) if label == "IO" else get_tier(org_conf, label),
        "indicators": nci["indicators"],
        "top_indicators": nci["top_indicators"],
        "platform": req.platform,
    }


class AnalyzeRequest(BaseModel):
    text: str
    io_confidence: float
    nci_score: int
    tier: str
    indicators: list


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    if not gemini_client:
        return {"error": "Gemini API not configured. Set the GEMINI_API_KEY environment variable and restart the backend."}

    def fmt_indicator(ind):
        name = INDICATOR_NAMES.get(ind['number'], f"Indicator {ind['number']}")
        return f"  - {name} (score: {ind['score']}/5)"

    indicator_lines = "\n".join(fmt_indicator(ind) for ind in req.indicators) or "  - None detected"

    prompt = f"""You are an expert in information operations (IO), propaganda analysis, and media literacy.
A social media post has been flagged as a potential information operation by an AI classifier.
Post: {req.text}
Classification Results:

IO Confidence: {req.io_confidence * 100:.1f}%
Threat Tier: {req.tier}

Analyze the post and provide a concise response of 1–3 paragraphs (3–4 sentences each) covering:

Which specific elements triggered the IO classification and why
The psychological or rhetorical techniques being used
The likely narrative goal or intent behind this type of content
How a reader can critically evaluate and respond to this messaging

Important considerations:
If the content appears benign despite its score, it may be a false positive caused by aggressive or vulgar language — tone alone can trigger IO classifiers without any manipulative intent. In these cases, explain that the flag may reflect tone rather than coordinated manipulation, and advise readers to consider context.
If the text is very short or resembles automated output (e.g., game scores, image captions, brief quips), note that short-form content is a known weak spot for IO classifiers and may produce ambiguous results. Such content may not be manipulative, but it isn't necessarily constructive either.
Be educational, balanced, and neutral. Do not make definitive claims about the author's intent.
"""


    try:
        response = await gemini_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return {"analysis": response.text}
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            return {"error": "Gemini API rate limit hit. Wait a minute and try again, or check your quota at ai.dev/rate-limit."}
        return {"error": f"Gemini error: {err[:200]}"}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "device": str(device) if device else "not loaded",
        "model": MODEL_NAME,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
