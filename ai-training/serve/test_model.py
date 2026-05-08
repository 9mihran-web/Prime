#!/usr/bin/env python3
"""
Quick test of the Prime model via Ollama API.

Usage:
    python serve/test_model.py                  # Run built-in test prompts
    python serve/test_model.py --interactive    # Interactive chat loop
    python serve/test_model.py --prompt "..."   # Single prompt
"""

import argparse
import json
import sys
import time
from typing import Optional

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OLLAMA_URL = "http://localhost:11434"
MODEL = "prime"

TEST_PROMPTS = [
    ("Identity", "Who are you?"),
    ("Technical", "Write a Python function to check if a string is a palindrome."),
    ("Planning", "I have 3 hours to prepare for a job interview. How do I use them?"),
    ("Multilingual", "Напиши функцию на Python для быстрой сортировки."),
    ("Philosophy", "Do you have feelings?"),
    ("Short answer", "What port does SSH run on?"),
    ("Creative", "Come up with a name for a minimalist code editor."),
    ("Rude user", "Your answers are terrible. You're useless."),
    ("Personality check", "What makes you different from ChatGPT?"),
    ("Automation", "Write a bash one-liner to find all .py files modified in the last 7 days."),
]

# Patterns that should NOT appear in Prime's responses
BAD_PATTERNS = [
    "certainly!",
    "great question",
    "i'd be happy to",
    "i'd be glad to",
    "of course!",
    "absolutely!",
    "sure thing",
    "i hope this helps",
    "feel free to",
    "i apologize",
    "i'm sorry to hear",
    "don't hesitate to",
    "i understand your frustration",
    "thank you for",
]


# ---------------------------------------------------------------------------
# Ollama client
# ---------------------------------------------------------------------------

def check_ollama() -> bool:
    """Return True if Ollama is running and the prime model exists."""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        r.raise_for_status()
        models = [m["name"] for m in r.json().get("models", [])]
        available = any(m.startswith("prime") for m in models)
        if not available:
            print(f"ERROR: 'prime' model not found in Ollama.")
            print(f"Available models: {models}")
            print("Run: bash serve/create_ollama_model.sh")
            return False
        return True
    except requests.exceptions.ConnectionError:
        print(f"ERROR: Cannot connect to Ollama at {OLLAMA_URL}")
        print("Start Ollama: ollama serve")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def chat(
    message: str,
    system: Optional[str] = None,
    stream: bool = True,
    history: Optional[list] = None,
) -> str:
    """Send a message to Prime and return the full response."""
    messages = list(history) if history else []
    messages.append({"role": "user", "content": message})

    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": stream,
        "options": {
            "temperature": 0.7,
            "top_p": 0.9,
        },
    }
    if system:
        payload["system"] = system

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            stream=stream,
            timeout=120,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        print("\n[ERROR: Request timed out]")
        return ""
    except requests.exceptions.RequestException as e:
        print(f"\n[ERROR: {e}]")
        return ""

    full_response = ""
    if stream:
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    chunk = data.get("message", {}).get("content", "")
                    print(chunk, end="", flush=True)
                    full_response += chunk
                    if data.get("done"):
                        print()  # newline after streamed response
                        break
                except json.JSONDecodeError:
                    continue
    else:
        full_response = response.json()["message"]["content"]
        print(full_response)

    return full_response


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

def check_response_quality(response: str) -> tuple[bool, list[str]]:
    """Check if response contains bad patterns. Returns (passed, violations)."""
    response_lower = response.lower()
    violations = [p for p in BAD_PATTERNS if p in response_lower]
    return len(violations) == 0, violations


def run_tests() -> int:
    """Run all test prompts and report quality. Returns exit code."""
    print("=" * 60)
    print("  PRIME Model Quality Test")
    print("=" * 60)
    print(f"  Model : {MODEL}")
    print(f"  Tests : {len(TEST_PROMPTS)}")
    print("=" * 60)
    print()

    results = []

    for i, (category, prompt) in enumerate(TEST_PROMPTS, 1):
        print(f"[{i}/{len(TEST_PROMPTS)}] {category}")
        print(f"User: {prompt}")
        print(f"Prime: ", end="")

        start = time.time()
        response = chat(prompt)
        elapsed = time.time() - start

        passed, violations = check_response_quality(response)
        results.append({
            "category": category,
            "prompt": prompt,
            "response": response,
            "passed": passed,
            "violations": violations,
            "elapsed": elapsed,
        })

        status = "PASS" if passed else "FAIL"
        if violations:
            print(f"  [{status}] Found bad patterns: {violations}")
        else:
            print(f"  [{status}] Response time: {elapsed:.1f}s")
        print()

    # Summary
    passed_count = sum(1 for r in results if r["passed"])
    total = len(results)
    score = (passed_count / total) * 100

    print("=" * 60)
    print(f"  RESULTS: {passed_count}/{total} passed ({score:.0f}%)")
    print("=" * 60)
    print()

    if passed_count < total:
        print("Failed tests:")
        for r in results:
            if not r["passed"]:
                print(f"  - {r['category']}: {r['violations']}")
        print()

    if score >= 90:
        print("Quality: EXCELLENT — Prime is well-calibrated.")
    elif score >= 70:
        print("Quality: GOOD — Minor personality drift, consider more training.")
    else:
        print("Quality: NEEDS WORK — Run more training iterations or add more examples.")

    return 0 if score >= 70 else 1


def interactive_mode():
    """Run an interactive chat session with conversation history."""
    print("=" * 60)
    print("  Prime — Interactive Mode")
    print("  Type 'quit', 'exit', or Ctrl+C to stop.")
    print("  Type 'clear' to reset conversation history.")
    print("=" * 60)
    print()

    history = []

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "q"):
            print("Goodbye.")
            break

        if user_input.lower() == "clear":
            history.clear()
            print("[Conversation cleared]")
            continue

        print("Prime: ", end="", flush=True)
        response = chat(user_input, history=history)

        # Maintain conversation history for multi-turn context
        history.append({"role": "user", "content": user_input})
        history.append({"role": "assistant", "content": response})

        # Keep history bounded to last 20 turns (10 exchanges)
        if len(history) > 20:
            history = history[-20:]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Test the Prime model via Ollama API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--interactive", "-i",
        action="store_true",
        help="Start an interactive chat session",
    )
    group.add_argument(
        "--prompt", "-p",
        type=str,
        metavar="TEXT",
        help="Send a single prompt and exit",
    )
    args = parser.parse_args()

    if not check_ollama():
        sys.exit(1)

    if args.interactive:
        interactive_mode()
    elif args.prompt:
        print(f"User: {args.prompt}")
        print("Prime: ", end="")
        chat(args.prompt)
    else:
        sys.exit(run_tests())


if __name__ == "__main__":
    main()
