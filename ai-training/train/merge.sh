#!/bin/bash
# Merge LoRA adapters into the base model and quantize for Ollama
# Usage: bash train/merge.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ ! -d ".venv" ]]; then
  echo "ERROR: .venv not found. Run setup.sh first."
  exit 1
fi
source .venv/bin/activate

echo "========================================================"
echo "  PRIME — Merging LoRA Adapters"
echo "========================================================"

# Check that adapters exist
if [[ ! -d "train/adapters" ]] || [[ -z "$(ls train/adapters/*.safetensors 2>/dev/null)" ]]; then
  echo "ERROR: No adapter files found in train/adapters/"
  echo "Run train/train.sh first."
  exit 1
fi

echo "Adapters found:"
ls -lh train/adapters/*.safetensors 2>/dev/null

echo ""
echo "[1/3] Fusing LoRA adapters into base model..."
echo "  This de-quantizes the base model, applies adapters, then re-saves."
echo "  Disk space required: ~16GB for de-quantized model"
echo ""

mkdir -p models

# Fuse adapters. --de-quantize converts from 4-bit back to float16 for clean fusion.
python -m mlx_lm.fuse \
  --model mlx-community/Meta-Llama-3.1-8B-Instruct-4bit \
  --adapter-path train/adapters \
  --save-path models/prime-8b \
  --de-quantize

echo ""
echo "  Merged model saved to: models/prime-8b"
echo ""

echo "[2/3] Re-quantizing merged model to 4-bit (for Ollama compatibility)..."
echo ""

python - <<'PYEOF'
import sys
try:
    from mlx_lm import convert
    convert(
        hf_path="models/prime-8b",
        mlx_path="models/prime-8b-q4",
        quantize=True,
        q_bits=4,
    )
    print("  Quantized model saved to: models/prime-8b-q4")
except ImportError as e:
    print(f"ERROR: {e}")
    print("Ensure mlx-lm is installed: pip install mlx-lm>=0.19.0")
    sys.exit(1)
PYEOF

echo ""
echo "[3/3] Converting to GGUF format for Ollama..."
echo ""

# Check if llama.cpp convert script is available (installed via Homebrew or manual)
if command -v python3 &>/dev/null && python3 -c "import gguf" 2>/dev/null; then
  echo "  gguf library found — attempting GGUF conversion..."
  python - <<'PYEOF'
import subprocess, sys, os
from pathlib import Path

model_dir = Path("models/prime-8b-q4")
output_gguf = Path("models/prime-8b-q4/prime-3b-q4.gguf")

# Try mlx-lm built-in GGUF export first
try:
    from mlx_lm.convert import convert_to_gguf  # available in newer versions
    convert_to_gguf(str(model_dir), str(output_gguf))
    print(f"  GGUF saved to: {output_gguf}")
except (ImportError, AttributeError):
    print("  mlx_lm.convert.convert_to_gguf not available in this version.")
    print("  Using llama.cpp fallback (requires llama.cpp to be installed).")
    result = subprocess.run(
        ["python3", "-m", "llama_cpp.convert", str(model_dir), "--outfile", str(output_gguf), "--outtype", "q4_0"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  Conversion failed: {result.stderr}")
        print("  Manual GGUF conversion instructions:")
        print("    git clone https://github.com/ggml-org/llama.cpp")
        print("    pip install -r llama.cpp/requirements.txt")
        print(f"    python llama.cpp/convert_hf_to_gguf.py models/prime-8b-q4 --outfile {output_gguf} --outtype q4_0")
    else:
        print(f"  GGUF saved to: {output_gguf}")
PYEOF
else
  echo "  gguf library not found. Skipping automatic GGUF conversion."
  echo ""
  echo "  To convert manually:"
  echo "    git clone https://github.com/ggml-org/llama.cpp"
  echo "    pip install -r llama.cpp/requirements.txt"
  echo "    python llama.cpp/convert_hf_to_gguf.py models/prime-8b-q4 \\"
  echo "           --outfile models/prime-8b-q4/prime-3b-q4.gguf --outtype q4_0"
fi

echo ""
echo "========================================================"
echo "  Merge complete!"
echo "========================================================"
echo ""
echo "Model artifacts:"
if [[ -d "models/prime-8b-q4" ]]; then
  du -sh models/prime-8b-q4/ 2>/dev/null
  ls models/prime-8b-q4/ 2>/dev/null
fi
echo ""
echo "Next step — register with Ollama:"
echo "  bash serve/create_ollama_model.sh"
