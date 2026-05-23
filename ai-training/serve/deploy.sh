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
  echo "ERROR: .venv not found."
  exit 1
fi
source .venv/bin/activate

# ── 2. Check adapters ─────────────────────────────────────────────────────────
if [[ -z "$(ls train/adapters/*.safetensors 2>/dev/null)" ]]; then
  echo "ERROR: No adapters in train/adapters/ — run training first"
  exit 1
fi
echo "✓ Adapters found: $(ls train/adapters/*.safetensors | wc -l | tr -d ' ') files"

# ── 3. Check disk space (need ~17GB free) ─────────────────────────────────────
AVAIL_GB=$(df -g . | awk 'NR==2{print $4}')
echo "  Free disk space: ${AVAIL_GB} GB"
if [[ "$AVAIL_GB" -lt 17 ]]; then
  echo ""
  echo "ERROR: Not enough disk space."
  echo "  Need:      ~17 GB free"
  echo "  Available: ${AVAIL_GB} GB"
  echo ""
  echo "Free up space and try again:"
  echo "  rm -rf models/           # delete old model files"
  echo "  Or free space in Finder → About This Mac → Storage"
  exit 1
fi

# ── 4. Fuse LoRA + dequantize → save MLX ─────────────────────────────────────
echo ""
echo "[1/3] Fusing LoRA adapters (dequantizing to float16)..."
echo "      Takes 10-20 min, uses ~16GB temporarily"
rm -rf models/prime-8b
mkdir -p models

mlx_lm fuse \
  --model mlx-community/Meta-Llama-3.1-8B-Instruct-4bit \
  --adapter-path train/adapters \
  --save-path models/prime-8b \
  --dequantize
echo "✓ Merged model → models/prime-8b"

# ── 5. Convert to GGUF via llama.cpp ─────────────────────────────────────────
echo ""
echo "[2/3] Converting to GGUF..."
GGUF_PATH="$SCRIPT_DIR/prime-8b-q4.gguf"

if [[ ! -d "llama.cpp" ]]; then
  echo "  Cloning llama.cpp..."
  git clone --depth=1 https://github.com/ggml-org/llama.cpp.git llama.cpp
fi
pip install -q gguf transformers sentencepiece protobuf 2>/dev/null || true

python llama.cpp/convert_hf_to_gguf.py \
  models/prime-8b \
  --outfile "$GGUF_PATH" \
  --outtype q8_0

echo "✓ GGUF → $GGUF_PATH ($(du -sh "$GGUF_PATH" | cut -f1))"

# Delete the large float16 model now that GGUF is ready
echo "  Cleaning up float16 model to free disk space..."
rm -rf models/prime-8b
echo "✓ Freed ~16GB"

# ── 6. Register with Ollama ───────────────────────────────────────────────────
echo ""
echo "[3/3] Registering Prime in Ollama..."
cd "$SCRIPT_DIR"
ollama create prime -f Modelfile

echo ""
echo "========================================================"
echo "  ✓ Prime fine-tuned model is ready!"
echo "========================================================"
echo "  Test:  ollama run prime"
echo "  Chat:  http://localhost:3000"
