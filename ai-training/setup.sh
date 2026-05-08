#!/bin/bash
set -e

echo "================================================"
echo "  PRIME AI Training Environment Setup"
echo "================================================"

# Check Apple Silicon
if [[ $(uname -m) != "arm64" ]]; then
  echo "ERROR: Apple Silicon (arm64) is required for MLX."
  echo "This script must run on an M1/M2/M3/M4 Mac."
  exit 1
fi

echo "[1/6] Checking macOS version..."
SW_VERS=$(sw_vers -productVersion)
MAJOR=$(echo "$SW_VERS" | cut -d. -f1)
if [[ $MAJOR -lt 13 ]]; then
  echo "WARNING: macOS 13 (Ventura) or later recommended. You have $SW_VERS."
fi
echo "  macOS $SW_VERS — OK"

echo "[2/6] Checking Homebrew..."
if ! which brew > /dev/null 2>&1; then
  echo "  Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon default location
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  echo "  Homebrew found — OK"
fi

echo "[3/6] Checking Ollama..."
if ! which ollama > /dev/null 2>&1; then
  echo "  Installing Ollama via Homebrew..."
  brew install ollama
else
  echo "  Ollama found — OK"
fi

echo "[4/6] Setting up Python virtual environment..."
# Prefer python3.11 or python3.10 for best MLX compatibility
PYTHON_BIN=""
for py in python3.11 python3.10 python3.12 python3; do
  if which $py > /dev/null 2>&1; then
    PY_VER=$($py --version 2>&1 | awk '{print $2}')
    PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
    if [[ $PY_MAJOR -eq 3 && $PY_MINOR -ge 9 ]]; then
      PYTHON_BIN=$py
      echo "  Using $PYTHON_BIN ($PY_VER)"
      break
    fi
  fi
done

if [[ -z "$PYTHON_BIN" ]]; then
  echo "  Python 3.9+ not found. Installing via Homebrew..."
  brew install python@3.11
  PYTHON_BIN=python3.11
fi

# Create venv at project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -d ".venv" ]]; then
  echo "  .venv already exists — skipping creation"
else
  $PYTHON_BIN -m venv .venv
  echo "  Virtual environment created at .venv/"
fi

source .venv/bin/activate
echo "  Virtual environment activated"

echo "[5/6] Installing Python dependencies..."
pip install -U pip --quiet
pip install -r requirements.txt

echo "[6/6] Downloading base model weights (Llama 3.1 8B 4-bit)..."
echo "  This will download ~4.5 GB. It may take several minutes..."
echo "  The model is cached in ~/.cache/huggingface after first download."
echo ""

python -c "
import sys
print('  Checking MLX installation...', flush=True)
try:
    import mlx.core as mx
    print(f'  MLX version: {mx.__version__}', flush=True)
except ImportError as e:
    print(f'  ERROR: MLX not installed correctly: {e}')
    sys.exit(1)

print('  Loading model (this triggers download if not cached)...', flush=True)
from mlx_lm import load
model, tokenizer = load('mlx-community/Meta-Llama-3.1-8B-Instruct-4bit')
print('  Model loaded successfully!', flush=True)
del model
"

echo ""
echo "================================================"
echo "  Setup complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Activate the environment:"
echo "       source .venv/bin/activate"
echo ""
echo "  2. Generate training data:"
echo "       python data/generate_dataset.py"
echo ""
echo "  3. Start fine-tuning:"
echo "       bash train/train.sh"
echo ""
echo "  4. After training, merge adapters:"
echo "       bash train/merge.sh"
echo ""
echo "  5. Deploy to Ollama:"
echo "       bash serve/create_ollama_model.sh"
echo ""
