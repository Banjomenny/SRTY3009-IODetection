from datetime import datetime
import csv
import os
import re
from sys import platform
import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from nci_scorer import score_text, get_tier


MODEL_NAME = "Banjomenny/DisInfoBert-Defended"

app = FastAPI(title="IO Detector API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

tokenizer = None
model = None
device = None


@app.on_event("startup")
async def load_model():
    global tokenizer, model, device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[IO Detector] Loading {MODEL_NAME} on {device}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME).to(device)
    model.eval()
    print(f"[IO Detector] Model ready on {device}")


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

    safe_platform = req.platform.replace('/', '').replace(' ', '_').replace('\\', '')
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
