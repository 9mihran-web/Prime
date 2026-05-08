#!/bin/bash
# Prime LoRA Fine-Tuning Launch Script
# Usage: bash train/train.sh
set -e

# Change to the ai-training root regardless of where the script is called from
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Activate virtual environment
if [[ ! -d ".venv" ]]; then
  echo "ERROR: .venv not found. Run setup.sh first."
  exit 1
fi
source .venv/bin/activate

echo "========================================================"
echo "  PRIME Fine-Tuning"
echo "========================================================"
echo "  Model  : Llama 3.1 8B Instruct (4-bit quantized)"
echo "  Method : LoRA (rank 8, 16 layers)"
echo "  Data   : data/train.jsonl (150 examples)"
echo "  Config : train/config.yaml"
echo ""
echo "  Estimated time:"
echo "    M1 Pro  (16GB) : ~45 minutes"
echo "    M2 Max  (32GB) : ~25 minutes"
echo "    M3 Ultra(64GB) : ~12 minutes"
echo "========================================================"
echo ""

# Verify training data exists
if [[ ! -f "data/train.jsonl" ]]; then
  echo "ERROR: data/train.jsonl not found."
  echo "Run: python data/generate_dataset.py"
  exit 1
fi

if [[ ! -f "data/valid.jsonl" ]]; then
  echo "ERROR: data/valid.jsonl not found."
  echo "Run: python data/generate_dataset.py"
  exit 1
fi

# Print data stats
TRAIN_LINES=$(wc -l < data/train.jsonl)
VALID_LINES=$(wc -l < data/valid.jsonl)
echo "Training examples : $TRAIN_LINES"
echo "Validation examples: $VALID_LINES"
echo ""

# Create adapter output directory
mkdir -p train/adapters

# Check available memory (warn if low)
MEMORY_GB=$(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.0f", $1/1024/1024/1024}' || echo "unknown")
echo "System unified memory: ${MEMORY_GB}GB"
if [[ "$MEMORY_GB" != "unknown" && "$MEMORY_GB" -lt 8 ]]; then
  echo "WARNING: Less than 8GB RAM detected. Training may run out of memory."
  echo "Consider reducing batch_size to 2 in train/config.yaml"
fi
echo ""

echo "Starting training at $(date)..."
echo "Log file: train/training.log"
echo ""

# Run LoRA fine-tuning via mlx-lm
python -m mlx_lm lora \
  --config train/config.yaml \
  2>&1 | tee train/training.log

echo ""
echo "========================================================"
echo "  Training complete at $(date)"
echo "========================================================"
echo ""
echo "Adapter files saved to: train/adapters/"
ls -lh train/adapters/ 2>/dev/null || echo "  (directory is empty — check training.log for errors)"
echo ""
echo "Next step — merge adapters into final model:"
echo "  bash train/merge.sh"
