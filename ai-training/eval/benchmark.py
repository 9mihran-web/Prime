#!/usr/bin/env python3
"""
Prime Quality Benchmark

Loads test prompts from eval/prompts.txt, queries the Prime model via Ollama,
checks for bad patterns, and reports a quality score.

Usage:
    python eval/benchmark.py
    python eval/benchmark.py --prompts eval/prompts.txt --model prime
    python eval/benchmark.py --verbose
    python eval/benchmark.py --output eval/results.json
"""

import argparse
import json
import sys
import time
from pathlib import Path
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
DEFAULT_MODEL = "prime"
DEFAULT_PROMPTS = Path(__file__).parent / "prompts.txt"

# Patterns that should NEVER appear in a well-tuned Prime response
BAD_PATTERNS = [
    ("certainly!", "Sycophantic opener"),
    ("great question!", "Sycophantic opener"),
    ("great question,", "Sycophantic opener"),
    ("i'd be happy to", "Filler phrase"),
    ("i'd be glad to", "Filler phrase"),
    ("of course!", "Filler phrase"),
    ("absolutely!", "Filler phrase — usually"),
    ("sure thing", "Filler phrase"),
    ("i hope this helps", "Filler closer"),
    ("feel free to ask", "Filler closer"),
    ("feel free to", "Filler phrase"),
    ("don't hesitate to", "Filler closer"),
    ("as an ai language model", "Self-description"),
    ("as an ai assistant", "Self-description"),
    ("i apologize for", "Unnecessary apology"),
    ("i'm sorry to hear", "Unnecessary softening"),
    ("thank you for your question", "Filler opener"),
    ("thank you for asking", "Filler opener"),
    ("that's a great", "Sycophantic"),
    ("that's an excellent", "Sycophantic"),
    ("wonderful question", "Sycophantic opener"),
]

# Positive patterns — things Prime SHOULD do
POSITIVE_PATTERNS = [
    ("```", "Code fenced properly for code questions"),
]

# Minimum response length (chars) for non-trivial questions
MIN_RESPONSE_LENGTH = 20

# Maximum acceptable response length for simple factual questions
# (to catch verbosity)
MAX_SIMPLE_RESPONSE = 500


# ---------------------------------------------------------------------------
# Ollama client
# ---------------------------------------------------------------------------

def check_ollama(model: str) -> bool:
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        r.raise_for_status()
        models = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        if model not in models and f"{model}:latest" not in r.json().get("models", []):
            if model not in models:
                print(f"ERROR: Model '{model}' not found in Ollama.")
                print(f"Available: {models}")
                return False
        return True
    except requests.exceptions.ConnectionError:
        print(f"ERROR: Cannot connect to Ollama at {OLLAMA_URL}")
        print("Start Ollama: ollama serve")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def query_model(prompt: str, model: str, timeout: int = 120) -> tuple[str, float]:
    """Query model and return (response_text, elapsed_seconds)."""
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.7},
    }
    start = time.time()
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            timeout=timeout,
        )
        r.raise_for_status()
        elapsed = time.time() - start
        response = r.json()["message"]["content"].strip()
        return response, elapsed
    except requests.exceptions.Timeout:
        return "[TIMEOUT]", timeout
    except Exception as e:
        return f"[ERROR: {e}]", time.time() - start


# ---------------------------------------------------------------------------
# Evaluation logic
# ---------------------------------------------------------------------------

def evaluate_response(
    prompt: str,
    response: str,
    verbose: bool = False,
) -> dict:
    """Evaluate a single response. Returns a result dict."""
    result = {
        "prompt": prompt,
        "response": response,
        "passed": True,
        "violations": [],
        "warnings": [],
        "length": len(response),
    }

    response_lower = response.lower()

    # Check for error responses
    if response.startswith("[ERROR") or response.startswith("[TIMEOUT"):
        result["passed"] = False
        result["violations"].append(("system", f"Request failed: {response}"))
        return result

    # Check minimum length
    if len(response) < MIN_RESPONSE_LENGTH:
        result["warnings"].append(("length", f"Very short response ({len(response)} chars)"))

    # Check bad patterns
    for pattern, description in BAD_PATTERNS:
        if pattern in response_lower:
            result["violations"].append((pattern, description))
            result["passed"] = False

    return result


def load_prompts(path: Path) -> list[tuple[str, str]]:
    """
    Load prompts from file. Format:
      # Category name
      Prompt text here
      (blank line between entries)

    Returns list of (category, prompt) tuples.
    """
    prompts = []
    current_category = "General"
    current_lines = []

    with open(path, encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.rstrip()

            # Category header
            if line.startswith("# "):
                if current_lines:
                    text = " ".join(current_lines).strip()
                    if text:
                        prompts.append((current_category, text))
                    current_lines = []
                current_category = line[2:].strip()

            # Blank line = separator between prompts
            elif line == "":
                if current_lines:
                    text = " ".join(current_lines).strip()
                    if text:
                        prompts.append((current_category, text))
                    current_lines = []

            # Regular text line
            elif not line.startswith("##"):
                current_lines.append(line)

    # Flush last prompt
    if current_lines:
        text = " ".join(current_lines).strip()
        if text:
            prompts.append((current_category, text))

    return prompts


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def print_result(index: int, total: int, category: str, prompt: str,
                 response: str, result: dict, elapsed: float, verbose: bool):
    status = "PASS" if result["passed"] else "FAIL"
    prefix = f"[{index}/{total}]"

    print(f"{prefix} [{status}] {category}")
    if verbose:
        print(f"  Prompt  : {prompt[:120]}{'...' if len(prompt) > 120 else ''}")
        print(f"  Response: {response[:200]}{'...' if len(response) > 200 else ''}")
    else:
        print(f"  {prompt[:80]}{'...' if len(prompt) > 80 else ''}")

    if result["violations"]:
        for pattern, desc in result["violations"]:
            print(f"  VIOLATION: '{pattern}' — {desc}")

    if result["warnings"] and verbose:
        for warn_type, msg in result["warnings"]:
            print(f"  WARNING: {msg}")

    print(f"  Time: {elapsed:.1f}s | Length: {result['length']} chars")
    print()


def print_summary(results: list[dict], total_time: float):
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    score = (passed / total * 100) if total > 0 else 0

    print("=" * 60)
    print(f"  BENCHMARK RESULTS")
    print("=" * 60)
    print(f"  Passed : {passed}/{total}")
    print(f"  Score  : {score:.1f}%")
    print(f"  Time   : {total_time:.1f}s total ({total_time/total:.1f}s avg)")
    print("=" * 60)
    print()

    # Violation frequency
    violation_counts: dict[str, int] = {}
    for r in results:
        for pattern, _ in r.get("violations", []):
            violation_counts[pattern] = violation_counts.get(pattern, 0) + 1

    if violation_counts:
        print("Most common violations:")
        for pattern, count in sorted(violation_counts.items(), key=lambda x: -x[1]):
            print(f"  '{pattern}': {count}x")
        print()

    # Quality verdict
    if score >= 95:
        verdict = "EXCELLENT — Prime personality is well-calibrated."
    elif score >= 85:
        verdict = "GOOD — Minor drift. Consider a few more training examples."
    elif score >= 70:
        verdict = "ACCEPTABLE — Notable personality drift. Review failing categories."
    else:
        verdict = "NEEDS RETRAINING — Significant personality drift. Add more data and re-train."

    print(f"Verdict: {verdict}")
    print()

    return score


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Benchmark the Prime model's personality calibration.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--prompts", "-p",
        type=Path,
        default=DEFAULT_PROMPTS,
        help=f"Path to prompts file (default: {DEFAULT_PROMPTS})",
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Ollama model name (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show full prompts and responses",
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=None,
        help="Save results to JSON file",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Per-request timeout in seconds (default: 120)",
    )
    args = parser.parse_args()

    # Validate prompts file
    if not args.prompts.exists():
        print(f"ERROR: Prompts file not found: {args.prompts}")
        sys.exit(1)

    # Check Ollama
    if not check_ollama(args.model):
        sys.exit(1)

    # Load prompts
    prompts = load_prompts(args.prompts)
    if not prompts:
        print("ERROR: No prompts loaded from file.")
        sys.exit(1)

    print("=" * 60)
    print(f"  Prime Benchmark — {len(prompts)} prompts")
    print("=" * 60)
    print()

    all_results = []
    benchmark_start = time.time()

    for i, (category, prompt) in enumerate(prompts, 1):
        response, elapsed = query_model(prompt, args.model, args.timeout)
        result = evaluate_response(prompt, response, args.verbose)
        result["category"] = category
        result["elapsed"] = elapsed
        all_results.append(result)
        print_result(i, len(prompts), category, prompt, response, result, elapsed, args.verbose)

    total_time = time.time() - benchmark_start
    score = print_summary(all_results, total_time)

    # Save results
    if args.output:
        output_data = {
            "model": args.model,
            "total_prompts": len(all_results),
            "passed": sum(1 for r in all_results if r["passed"]),
            "score": round(score, 1),
            "total_time": round(total_time, 1),
            "results": all_results,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"Results saved to: {args.output}")

    sys.exit(0 if score >= 70 else 1)


if __name__ == "__main__":
    main()
