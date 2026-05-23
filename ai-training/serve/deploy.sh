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

# ── 3. Fuse LoRA adapters + export GGUF in one step ──────────────────────────
echo ""
echo "[1/2] Fusing LoRA adapters and exporting GGUF..."
echo "      (takes 10-20 min, needs ~16GB disk)"
mkdir -p models
GGUF_PATH="$SCRIPT_DIR/prime-8b-q4.gguf"

mlx_lm fuse \
  --model mlx-community/Meta-Llama-3.1-8B-Instruct-4bit \
  --adapter-path train/adapters \
  --save-path models/prime-8b \
  --dequantize \
  --export-gguf \
  --gguf-path "$GGUF_PATH"

echo "✓ GGUF saved → $GGUF_PATH ($(du -sh "$GGUF_PATH" | cut -f1))"

# ── 4. Register with Ollama ───────────────────────────────────────────────────
echo ""
echo "[2/2] Registering Prime in Ollama..."
cd "$SCRIPT_DIR"
ollama create prime -f Modelfile

echo ""
echo "========================================================"
echo "  ✓ Prime fine-tuned model is ready!"
echo "========================================================"
echo ""
echo "  Test: ollama run prime"
echo "  Chat: http://localhost:3000"
