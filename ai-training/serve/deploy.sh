#!/bin/bash
# Full pipeline: merge LoRA → convert to GGUF → register in Ollama
# Usage: bash serve/deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================================"
echo "  PRIME — Deploy Fine-Tuned Model"
echo "========================================================"

# ── 1. Activate venv ──────────────────────────────────────────────────────────
if [[ ! -d ".venv" ]]; then
  echo "ERROR: .venv not found. Run: python3 -m venv .venv && source .venv/bin/activate && pip install mlx-lm"
  exit 1
fi
source .venv/bin/activate

# ── 2. Check adapters ─────────────────────────────────────────────────────────
if [[ -z "$(ls train/adapters/*.safetensors 2>/dev/null)" ]]; then
  echo "ERROR: No adapters in train/adapters/ — run training first"
  exit 1
fi
echo "✓ Adapters found: $(ls train/adapters/*.safetensors | wc -l | tr -d ' ') files"

# ── 3. Fuse LoRA adapters with base model ─────────────────────────────────────
echo ""
echo "[1/4] Fusing LoRA adapters into base model..."
echo "      (takes 5-10 min, uses ~16GB disk)"
mkdir -p models

python -m mlx_lm.fuse \
  --model mlx-community/Meta-Llama-3.1-8B-Instruct-4bit \
  --adapter-path train/adapters \
  --save-path models/prime-8b \
  --de-quantize
echo "✓ Merged model → models/prime-8b"

# ── 4. Clone llama.cpp if needed ──────────────────────────────────────────────
echo ""
echo "[2/4] Setting up llama.cpp for GGUF conversion..."
if [[ ! -d "llama.cpp" ]]; then
  git clone --depth=1 https://github.com/ggml-org/llama.cpp.git llama.cpp
fi
pip install -q -r llama.cpp/requirements.txt 2>/dev/null || \
  pip install -q gguf transformers huggingface_hub numpy
echo "✓ llama.cpp ready"

# ── 5. Convert to GGUF ────────────────────────────────────────────────────────
echo ""
echo "[3/4] Converting to GGUF (Q4_K_M quantization)..."
GGUF_PATH="$SCRIPT_DIR/prime-8b-q4.gguf"

python llama.cpp/convert_hf_to_gguf.py \
  models/prime-8b \
  --outfile "$GGUF_PATH" \
  --outtype q4_k_m
echo "✓ GGUF saved → $GGUF_PATH ($(du -sh "$GGUF_PATH" | cut -f1))"

# ── 6. Register with Ollama ───────────────────────────────────────────────────
echo ""
echo "[4/4] Registering Prime in Ollama..."
cd "$SCRIPT_DIR"
ollama create prime -f Modelfile

echo ""
echo "========================================================"
echo "  ✓ Prime fine-tuned model is ready!"
echo "========================================================"
echo ""
echo "  Test: ollama run prime"
echo "  Chat: http://localhost:3000"
