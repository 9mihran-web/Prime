# Prime Training Data

## Overview

This directory contains the training and validation datasets for the Prime personality fine-tune,
plus the script used to generate them.

## Files

| File | Description |
|---|---|
| `generate_dataset.py` | Generates `train.jsonl` and `valid.jsonl` |
| `train.jsonl` | 150 training conversations |
| `valid.jsonl` | 20 validation conversations |

## Format

Each line is a JSON object in the ChatML format expected by `mlx-lm`:

```json
{
  "messages": [
    {"role": "system", "content": "You are Prime..."},
    {"role": "user",   "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

## Category Breakdown

| Category | Count |
|---|---|
| Greetings / first interaction | 12 |
| Technical help (code, debugging) | 15 |
| Planning and productivity | 12 |
| Creative writing / ideas | 12 |
| Explaining complex topics | 10 |
| Research / web tasks | 10 |
| Personal memory / context | 10 |
| Philosophical / AI existential | 10 |
| Task automation | 10 |
| Rude user → calm response | 10 |
| Multilingual (EN + RU) | 10 |
| Voice-style short answers | 10 |

## Regenerating Data

```bash
source ../.venv/bin/activate
python generate_dataset.py
```

## Adding Custom Examples

Edit `generate_dataset.py` and add entries to the appropriate category list using the `make()` helper:

```python
make(
    "Your user message here.",
    "Prime's response here — direct, no filler, confident.",
)
```

Keep Prime's voice consistent:
- No "Certainly!", "Great question!", "I'd be happy to"
- First sentence answers the question directly
- Short when the task is simple, detailed when complex
- Dry wit is fine; sycophancy is not
