#!/bin/bash
# Register the Prime model with Ollama
# Usage: bash serve/create_ollama_model.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Locate the GGUF file
# ---------------------------------------------------------------------------
GGUF_PATH="$PROJECT_ROOT/models/prime-8b-q4/prime-8b-q4.gguf"

if [[ ! -f "$GGUF_PATH" ]]; then
  echo "ERROR: GGUF file not found at:"
  echo "  $GGUF_PATH"
  echo ""
  echo "Complete the merge step first:"
  echo "  bash train/merge.sh"
  echo ""
  echo "If you converted the GGUF manually to a different path, edit GGUF_PATH in this script."
  exit 1
fi

echo "GGUF found: $GGUF_PATH ($(du -sh "$GGUF_PATH" | cut -f1))"

# ---------------------------------------------------------------------------
# Ensure Ollama is running
# ---------------------------------------------------------------------------
if ! ollama list > /dev/null 2>&1; then
  echo "Ollama not responding. Starting it..."
  ollama serve &
  OLLAMA_PID=$!
  # Wait for Ollama to be ready
  for i in {1..15}; do
    if ollama list > /dev/null 2>&1; then
      echo "Ollama is ready."
      break
    fi
    sleep 2
    echo "  Waiting... ($i/15)"
  done
  if ! ollama list > /dev/null 2>&1; then
    echo "ERROR: Ollama failed to start. Try running 'ollama serve' in a separate terminal."
    exit 1
  fi
else
  echo "Ollama is running."
fi

# ---------------------------------------------------------------------------
# Copy GGUF to the serve directory (Ollama resolves FROM paths relative to
# the directory where ollama create is invoked)
# ---------------------------------------------------------------------------
echo ""
echo "Copying GGUF to serve directory..."
cp "$GGUF_PATH" "$SCRIPT_DIR/prime-8b-q4.gguf"
echo "  Done: $(du -sh "$SCRIPT_DIR/prime-8b-q4.gguf" | cut -f1)"

# ---------------------------------------------------------------------------
# Create (or update) the model in Ollama
# ---------------------------------------------------------------------------
echo ""
echo "Registering 'prime' model in Ollama..."
cd "$SCRIPT_DIR"
ollama create prime -f Modelfile

echo ""
echo "========================================================"
echo "  Prime is ready!"
echo "========================================================"
echo ""
echo "Test in terminal:"
echo "  ollama run prime"
echo ""
echo "API endpoint:"
echo "  http://localhost:11434/api/chat"
echo ""
echo "Test script:"
echo "  cd $PROJECT_ROOT && source .venv/bin/activate && python serve/test_model.py"
echo ""
echo "Run interactively:"
echo "  python serve/test_model.py --interactive"
