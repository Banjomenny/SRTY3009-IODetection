# SRTY-3009 A3 — Model Training & Security Evaluation
## Context for Claude Code

---

## Project Overview

This is Assignment 3 of a 4-part cybersecurity AI project. The goal is to train, fine-tune, and adversarially attack an influence operation (IO) detection model. We are detecting coordinated inauthentic behavior (IO) in social media posts using NLP.

**Course:** SRTY-3009 — Security AI, Summer 2026  
**Students:** Benjamin Morrison, Logan Pukarowski  
**Due:** Friday June 12 2026 11:59 PM  
**Platform:** Google Colab (share link for submission) + PDF report

---

## What Was Built in A1 and A2

**A1 — Baseline Model:**
- Dataset: FiveThirtyEight IRA tweets (IO class) + Kaggle political tweets (organic class)
- Model: TF-IDF + Logistic Regression
- Baseline F1: 0.83
- Found temporal bias — model learning era vocabulary not manipulation patterns
- Built iterative debiasing pipeline using NER normalization

**A2 — Dataset:**
- Two datasets combined:
  - `info_op` — verified IO tweets 2020-2021 from Internet Archive
  - `legitimate` — organic political tweets 2021-2022
- Cleaned, aligned, tokenized with `cardiffnlp/twitter-roberta-base`
- Train/test split 80/20 stratified
- Balanced training set via undersampling
- Output: `X_train_bal`, `X_test`, `y_train_bal`, `y_test` as numpy arrays of token IDs
- Raw text also preserved: `X_train_text_bal`, `X_test_text` as pandas Series

---

## A3 Task — Four Steps

### Step 1 — Baseline Results (15 pts)

Show model performance before any changes. This is the A2 Twitter-RoBERTa fine-tuned model as the baseline.

**Deliverables:**
- Classification report (accuracy, precision, recall, F1)
- Confusion matrix
- Weighted average F1 noted clearly
- Training time using `%%time`

---

### Step 2 — Fine-Tuning & Improvements (30 pts)

Improve the model and compare against baseline.

**For NLP/RoBERTa the equivalent of feature importance and hyperparameter tuning:**

Feature importance equivalent:
- Attention weight visualization — which tokens RoBERTa focuses on
- Top weighted terms from a TF-IDF layer if added
- Or: ablation study — remove different text cleaning steps and measure F1 impact

Hyperparameter tuning equivalent (GridSearchCV equivalent for transformers):
- Learning rate: try [1e-5, 2e-5, 5e-5]
- Batch size: try [8, 16, 32]
- Epochs: try [2, 3, 5]
- Use HuggingFace Trainer with different configs, report best

**Deliverables:**
- Feature/token importance visualization
- Hyperparameters tried and best found
- Before vs after comparison table:

```
Metric          Baseline (TF-IDF+LR)    Fine-tuned (RoBERTa)    Change
F1 weighted     0.83                    ???                     up/down
Accuracy        0.83                    ???                     up/down
Model size      TF-IDF vocab            125M params             larger
```

---

### Step 3 — Prediction Pipeline Demo (30 pts)

Show model making live predictions on real rows from test set.

**Deliverables:**
- 3 prediction examples: 1 Organic + 2 IO
- For each: real label, predicted label, confidence score
- Note any surprising or incorrect predictions

**Function to build:**
```python
def predict_post(text):
    # tokenize text
    # run through fine-tuned RoBERTa
    # return: real label, predicted label, confidence score
    # print formatted output matching prof's example format
```

---

### Step 4 — Adversarial Attack & Defence (15 pts)

**Note from rubric:** Professor says use the attack that fits your model type. For NLP the recommendation is **TextFooler**. This is the correct attack for transformer text classifiers.

**TextFooler attack:**
- Replaces words with semantically similar synonyms
- Goal: change model prediction while keeping text readable
- Directly mirrors real-world IO evasion — operators paraphrasing content to evade detectors

**Epsilon equivalent for NLP:**
Instead of epsilon values (which apply to continuous numeric features), use perturbation rate — percentage of words replaced:
- 0% replacement (no attack)
- 5% replacement
- 10% replacement
- 20% replacement

**Deliverables:**
- Test 4 perturbation levels: 0%, 5%, 10%, 20%
- Accuracy vs perturbation rate line chart
- One defence implemented — options:
  - **Adversarial training** — fine-tune on adversarial examples (best for NLP)
  - **Input preprocessing** — synonym normalization before classification
  - **Ensemble** — combine RoBERTa with TF-IDF, harder to fool both
- Before vs after defence metrics at 10% perturbation
- Written explanation of whether defence worked and trade-offs

---

## Technical Stack

**Model:**
- `cardiffnlp/twitter-roberta-base` from HuggingFace
- Fine-tuned for binary classification (IO=1, Organic=0)
- Tokenizer max_length=512
- Device: CUDA (T4 GPU on Kaggle) or CPU fallback

**Libraries:**
```
transformers
torch
datasets
sklearn
numpy
pandas
matplotlib
textattack  # for TextFooler adversarial attack
```

**Data:**
- `X_train_bal` — numpy array (N, 128) token IDs, balanced training set
- `X_test` — numpy array (N, 128) token IDs
- `y_train_bal` — numpy array of labels (0/1)
- `y_test` — numpy array of labels (0/1)
- `X_train_text_bal` — pandas Series of raw text (needed for TextFooler)
- `X_test_text` — pandas Series of raw text (needed for TextFooler)

---

## Notebook Structure

All code in one Google Colab notebook.

```
Cell 1:  Install & imports
Cell 2:  Load A2 dataset (from Kaggle or Drive)
Cell 3:  Step 1 — Baseline: fine-tune RoBERTa, get baseline metrics
Cell 4:  Step 2 — Fine-tuning: hyperparameter search, before vs after table
Cell 5:  Step 3 — Prediction pipeline demo (3 examples)
Cell 6:  Step 4a — TextFooler adversarial attack at 4 perturbation levels
Cell 7:  Step 4b — Defence implementation + before/after comparison
```

---

## Report Structure (PDF)

Five sections, use actual numbers not vague claims:

| Section | Content |
|---|---|
| 1 Model & Dataset | Dataset description, security problem, baseline RoBERTa metrics, confusion matrix |
| 2 Fine-Tuning | Hyperparameters tried, best config, before vs after F1 table |
| 3 Prediction Demo | 3 examples with real label, predicted label, confidence. Note surprises |
| 4 Attack Results | Accuracy vs perturbation table and chart. At what % did it break? Real-world risk? |
| 5 Defence & Reflection | Which defence? Before/after metrics. Trade-offs. What would you deploy in production? |

---

## Key Academic Arguments to Make

**Why TextFooler not FGSM:**
FGSM is designed for continuous numeric features (pixel values, network packet sizes). Our model operates on discrete text tokens — you cannot add a continuous epsilon perturbation to a token ID. TextFooler is the correct NLP adversarial attack, recommended by the rubric itself for NLP models.

**Why this matters for cybersecurity:**
Real IO operators already use paraphrasing and synonym substitution to evade keyword filters. TextFooler simulates exactly this real-world evasion technique. Our adversarial evaluation directly mirrors the threat model.

**Why adversarial training is the best defence:**
Fine-tuning on adversarial examples teaches the model to recognize manipulation patterns even when surface vocabulary is changed. This is more robust than input preprocessing which can be bypassed by more sophisticated paraphrasing.

**Why RoBERTa over TF-IDF+LR:**
TF-IDF treats text as a bag of words — word order and context lost. RoBERTa uses contextual attention — understands that "not dangerous" and "dangerous" are opposites. IO content relies heavily on framing and context which RoBERTa captures and TF-IDF misses.

---

## Hardware

**Kaggle Notebook (for training):**
- T4 GPU x2
- 30hrs/week free
- Use for RoBERTa fine-tuning and TextFooler generation
- Save weights to `/kaggle/working/` after training

**Local 5820 (for inference/A4 app):**
- 2x Quadro RTX 4000 (8GB each)
- Run fine-tuned model locally for A4 extension backend
- Download weights from Kaggle after training

---

## Dataset Loading in A3 Notebook

```python
# Option A — from Kaggle dataset
import kagglehub
path = kagglehub.dataset_download('banjomenny/srty3009-io-dataset-v2')

# Option B — from Google Drive
from google.colab import drive
drive.mount('/content/drive')
# load cleaned_dataset_normalized.csv from Drive

# After loading run the A2 cleaning pipeline to produce:
# X_train_bal, X_test, y_train_bal, y_test (token ID arrays)
# X_train_text_bal, X_test_text (raw text Series for TextFooler)
```

---

## Converting Token Arrays to HuggingFace Dataset

```python
from datasets import Dataset
import torch

def arrays_to_dataset(X_ids, y):
    # X_ids is numpy (N, 128) token IDs
    # Need to reconstruct attention masks
    attention_masks = (X_ids != tokenizer.pad_token_id).astype(int)
    
    return Dataset.from_dict({
        'input_ids': X_ids.tolist(),
        'attention_mask': attention_masks.tolist(),
        'labels': y.tolist()
    })

train_dataset = arrays_to_dataset(X_train_bal, y_train_bal)
test_dataset  = arrays_to_dataset(X_test, y_test)
```

---

## Fine-Tuning with HuggingFace Trainer

```python
from transformers import (
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer
)
from sklearn.metrics import f1_score, accuracy_score
import numpy as np

model = AutoModelForSequenceClassification.from_pretrained(
    'cardiffnlp/twitter-roberta-base',
    num_labels=2
)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    return {
        'f1':       f1_score(labels, predictions, average='weighted'),
        'accuracy': accuracy_score(labels, predictions)
    }

training_args = TrainingArguments(
    output_dir='./results',
    num_train_epochs=3,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=32,
    learning_rate=2e-5,
    evaluation_strategy='epoch',
    save_strategy='epoch',
    load_best_model_at_end=True,
    metric_for_best_model='f1',
    fp16=True,  # faster on T4
    logging_steps=100,
    report_to='none'
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset,
    compute_metrics=compute_metrics
)

trainer.train()
```

---

## TextFooler Attack

```python
# Install textattack
# !pip install textattack -q

import textattack
from textattack.models.wrappers import HuggingFaceModelWrapper
from textattack.attack_recipes import TextFoolerJin2019
from textattack.datasets import Dataset as TADataset

# Wrap fine-tuned model for textattack
model_wrapper = HuggingFaceModelWrapper(model, tokenizer)

# Build attack
attack = TextFoolerJin2019.build(model_wrapper)

# Test on subset of test data (TextFooler is slow — use 200-500 examples)
test_subset = list(zip(X_test_text[:200], y_test[:200]))
dataset = TADataset(test_subset)

# Run attack and collect results
from textattack import Attacker, AttackArgs

attack_args = AttackArgs(
    num_examples=200,
    random_seed=42
)
attacker = Attacker(attack, dataset, attack_args)
results = attacker.attack_dataset()
```

---

## File Naming

```
Notebook: SRTY3009_A3_IODetection_TwitterRoBERTa.ipynb
Report:   SRTY3009_A3_Report_BenjaminMorrison_LoganPukarowski.pdf
```

---

## Important Notes for Claude Code

1. **A2 pipeline must run first** — load dataset, clean, tokenize, balance, split before any A3 training

2. **Keep raw text alongside token arrays** — TextFooler needs raw text strings not token IDs

3. **Save model after fine-tuning** — `trainer.save_model('./finetuned-roberta')` — download from Kaggle for A4

4. **TextFooler is slow** — run on 200-500 test examples max, not full test set

5. **Perturbation rate not epsilon** — TextFooler uses word substitution rate, map this to the rubric's epsilon concept in your report

6. **fp16=True** on Kaggle T4 for faster training

7. **Generate and save all charts as PNG** — needed for PDF report screenshots

8. **Classification report labels** — use `target_names=['Organic', 'IO']` for readability

9. **Confusion matrix labels** — `display_labels=['Organic', 'IO']`

10. **Training time** — add `%%time` magic to training cell for Step 1 deliverable
