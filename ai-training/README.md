# Prime — MLX Fine-Tuning Pipeline

Fine-tune Llama 3.1 8B with LoRA adapters on Apple Silicon to produce **Prime**: a direct, precise, minimalist AI assistant with a slightly futuristic personality.

---

## Overview

| Component | Description |
|---|---|
| **Base model** | `meta-llama/Meta-Llama-3.1-8B-Instruct` (4-bit quantized) |
| **Framework** | Apple MLX + mlx-lm |
| **Method** | LoRA (Low-Rank Adaptation) — only a small set of adapter weights are trained |
| **Serving** | Ollama (local HTTP API + CLI) |
| **Personality** | Direct, precise, no filler phrases, confident without arrogance |

### Why LoRA?

Full fine-tuning a 8B model requires ~80GB of GPU VRAM. LoRA trains only a small set of rank-decomposed matrices (< 1% of total parameters), making it feasible on a 16GB Apple Silicon Mac with MLX's efficient Metal backend.

---

## Hardware Requirements

| Hardware | Min RAM | Estimated Training Time |
|---|---|---|
| M1 / M2 (base) | 8GB | ~80 min (batch_size: 2) |
| M1 Pro / M2 Pro | 16GB | ~45 min |
| M2 Max / M3 Max | 32GB | ~25 min |
| M2 Ultra / M3 Ultra | 64GB+ | ~12 min |

**Requirements:**
- Apple Silicon Mac (M1/M2/M3/M4 — arm64)
- macOS 13 Ventura or later
- Python 3.9+
- ~10GB free disk space for model weights
- ~5GB additional disk for merged model + GGUF

---

## Quick Start

```bash
# 1. Clone / open this directory
cd ai-training/

# 2. One-shot setup (installs deps, downloads model ~4.5GB)
bash setup.sh

# 3. Activate environment
source .venv/bin/activate

# 4. Generate training data
python data/generate_dataset.py

# 5. Fine-tune (~45 min on M1 Pro)
bash train/train.sh

# 6. Merge adapters into final model
bash train/merge.sh

# 7. Register with Ollama and test
bash serve/create_ollama_model.sh
ollama run prime
```

---

## Step-by-Step Guide

### Step 1 — Setup

```bash
bash setup.sh
```

This script:
1. Verifies Apple Silicon (exits if not arm64)
2. Installs Homebrew if missing
3. Installs Ollama via Homebrew
4. Creates a Python virtual environment at `.venv/`
5. Installs all Python dependencies from `requirements.txt`
6. Downloads Llama 3.1 8B (4-bit, ~4.5GB) from Hugging Face

The model is cached at `~/.cache/huggingface/` after the first download.

### Step 2 — Generate Training Data

```bash
source .venv/bin/activate
python data/generate_dataset.py
```

Produces:
- `data/train.jsonl` — 150 training examples
- `data/valid.jsonl` — 20 validation examples

Each line is a JSON object with `messages` in ChatML format (system/user/assistant).

**To add your own examples**, edit `data/generate_dataset.py` and add to any category list using `make(user_text, assistant_text)`.

### Step 3 — Fine-Tune

```bash
bash train/train.sh
```

Runs `mlx_lm.lora` with the configuration in `train/config.yaml`. Key parameters:

| Parameter | Value | Notes |
|---|---|---|
| `lora_rank` | 8 | Adapter expressiveness; try 16 on 16GB+ |
| `lora_layers` | 16 | Top-N transformer layers to adapt |
| `batch_size` | 4 | Reduce to 2 if you hit OOM on 8GB |
| `iters` | 600 | ~16 epochs over 150 examples |
| `learning_rate` | 1e-5 | Conservative; good for personality tuning |

Training logs are saved to `train/training.log`. Adapter checkpoints are saved every 100 steps to `train/adapters/`.

**Monitor training loss** in the log. You want the train loss to decrease from ~2.0 toward ~1.0–1.3. Validation loss should track (not diverge significantly — that's overfitting).

### Step 4 — Merge Adapters

```bash
bash train/merge.sh
```

This:
1. Fuses the LoRA adapters into the base model (de-quantizing first)
2. Re-quantizes to 4-bit for efficient serving
3. Converts to GGUF format for Ollama

Output: `models/prime-8b-q4/` (~4.5GB)

**Note on GGUF conversion**: The merge script attempts automatic GGUF conversion. If it fails (depends on mlx-lm version), run the manual conversion:

```bash
# Install llama.cpp
git clone https://github.com/ggml-org/llama.cpp
pip install -r llama.cpp/requirements.txt

# Convert
python llama.cpp/convert_hf_to_gguf.py models/prime-8b-q4 \
  --outfile models/prime-8b-q4/prime-8b-q4.gguf \
  --outtype q4_0
```

### Step 5 — Deploy to Ollama

```bash
bash serve/create_ollama_model.sh
```

This copies the GGUF to `serve/`, registers the model in Ollama using `serve/Modelfile`, and prints the test command.

**Test the model:**
```bash
# CLI
ollama run prime

# Python test suite
python serve/test_model.py

# Interactive chat
python serve/test_model.py --interactive

# Single prompt
python serve/test_model.py --prompt "Who are you?"
```

---

## Connecting to the PRIME Backend

The PRIME backend (in `../backend/`) connects to Ollama's REST API at `http://localhost:11434`.

Once `prime` is registered in Ollama, no backend changes are needed — it queries the model by name.

**API endpoint:**
```
POST http://localhost:11434/api/chat
{
  "model": "prime",
  "messages": [{"role": "user", "content": "..."}],
  "stream": true
}
```

**Start Ollama as a background service (macOS):**
```bash
# One-time service registration
brew services start ollama

# Or run manually
ollama serve
```

---

## Retraining with Custom Data

### Add new examples

Edit `data/generate_dataset.py`. Add your examples to the appropriate category:

```python
make(
    "Your user message here.",
    "Prime's response — direct, no filler, precise.",
)
```

Regenerate and retrain:

```bash
python data/generate_dataset.py
bash train/train.sh
```

### Train from a previous checkpoint

To continue from a saved adapter checkpoint:

```bash
python -m mlx_lm.lora \
  --config train/config.yaml \
  --resume-adapter-file train/adapters/adapters.safetensors
```

### Replace the dataset entirely

To train on a completely custom dataset:
1. Create your own `train.jsonl` and `valid.jsonl` in the same ChatML format
2. Update `data:` path in `train/config.yaml` if needed
3. Run `bash train/train.sh`

---

## Evaluation

Run the benchmark to check personality calibration:

```bash
source .venv/bin/activate
python eval/benchmark.py
```

The benchmark:
1. Loads 20 test prompts from `eval/prompts.txt`
2. Queries the `prime` Ollama model
3. Checks each response for bad patterns (sycophantic openers, filler phrases)
4. Reports pass/fail and overall quality score

**Score interpretation:**
- 95%+ — Excellent
- 85–94% — Good, minor drift
- 70–84% — Acceptable, review failing categories
- <70% — Needs retraining

Save results to JSON:
```bash
python eval/benchmark.py --output eval/results.json --verbose
```

---

## Troubleshooting

### `mlx` not found / ImportError
```bash
# Verify arm64
uname -m  # must print: arm64

# Reinstall
source .venv/bin/activate
pip uninstall mlx mlx-lm -y
pip install mlx-lm>=0.19.0
```

### Out of memory during training
```yaml
# In train/config.yaml, reduce:
batch_size: 2        # was 4
lora_layers: 8       # was 16
max_seq_length: 1024 # was 2048
```

### Model download stuck / slow
The base model is ~4.5GB. If the download hangs, it's likely a network issue.
Retry with the HuggingFace CLI for better progress visibility:
```bash
pip install huggingface_hub[cli]
huggingface-cli download mlx-community/Meta-Llama-3.1-8B-Instruct-4bit
```

### Loss stuck / not decreasing
- Learning rate may be too high. Try `learning_rate: 5e-6`
- Check that `data/train.jsonl` is valid JSONL (each line is valid JSON)
- Verify the system prompt is in every example

### `ollama create` fails: file not found
The GGUF path in `Modelfile` is relative to where `ollama create` is called.
`create_ollama_model.sh` handles this by copying the GGUF to the serve directory.
If running manually, `cd` to `serve/` first.

### `ollama run prime` gives generic responses (not Prime)
The base model is responding instead of the fine-tuned one. Check:
1. The GGUF file is the fine-tuned version (`models/prime-8b-q4/`), not the base
2. `merge.sh` completed without errors
3. Re-run `create_ollama_model.sh` to re-register

### MLX kernel panics / system crash
Rare but possible on 8GB machines. Lower `max_seq_length` to 512 and `batch_size` to 1.
Make sure no other GPU-heavy apps (games, video editing) are running.

---

## File Reference

```
ai-training/
├── README.md               # This file
├── requirements.txt        # Python dependencies
├── setup.sh                # One-shot setup script
├── data/
│   ├── generate_dataset.py # Dataset generation script
│   ├── train.jsonl         # 150 training examples (ChatML format)
│   ├── valid.jsonl         # 20 validation examples
│   └── README.md           # Data format documentation
├── train/
│   ├── config.yaml         # MLX LoRA training configuration
│   ├── train.sh            # Training launch script
│   ├── merge.sh            # Adapter fusion + GGUF conversion
│   └── adapters/           # Saved LoRA adapter weights (after training)
├── models/
│   ├── prime-8b/           # De-quantized merged model (float16)
│   └── prime-8b-q4/        # Re-quantized model + GGUF for Ollama
├── serve/
│   ├── Modelfile           # Ollama model definition
│   ├── create_ollama_model.sh  # Register model in Ollama
│   └── test_model.py       # Test script (batch + interactive)
└── eval/
    ├── benchmark.py        # Personality quality benchmark
    └── prompts.txt         # 20 evaluation prompts
```
