#!/usr/bin/env python3
"""
BeatScout Qwen3-Omni Audio Analysis CLI

Analyze audio tracks for danceability, temperament, and production quality
using the Qwen3-Omni multimodal model (complementing the CLAP-based pipeline).

Usage:
    python analyse_qwen3.py <audio_file> [--json] [--verbose]
    python analyse_qwen3.py resources/example.mp3
    python analyse_qwen3.py resources/track.wav --json --verbose

Model Information:
    - Model: Qwen/Qwen3-Omni-30B-A3B-Instruct (~30B parameters, ~3B active via MoE)
    - Cache Location: models/Qwen3-Omni-30B-A3B-Instruct/ (local download)
    - HuggingFace Hub Cache: ~/.cache/huggingface/hub/ (fallback)
    - First run: Downloads ~15GB of model weights (may take time)
    - Subsequent runs: Loads from local cache

Hardware Requirements:
    - Recommended: GPU with ≥24GB VRAM for reasonable inference speed
    - Minimum: CPU (very slow, not recommended for production use)
    - Apple Silicon: Falls back to MPS/CPU

Dependencies:
    - transformers (requires recent version: pip install git+https://github.com/huggingface/transformers.git)
    - qwen-omni-utils
    - audioread
    - torch

Output:
    Returns JSON with production_quality, danceability, temperament scores (0-100),
    plus genre and description fields.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


# Dependencies imported lazily to allow --help to work without all deps installed
TORCH = None
TRANSFORMERS = None
QWEN_UTILS = None


def _import_dependencies():
    """Lazy import of dependencies to allow --help without full install."""
    global TORCH, TRANSFORMERS, QWEN_UTILS
    if TORCH is None:
        try:
            import torch
            from transformers import (
                Qwen3OmniMoeForConditionalGeneration,
                Qwen3OmniMoeProcessor,
            )
            from qwen_omni_utils import process_mm_info

            TORCH = torch
            TRANSFORMERS = {
                "Qwen3OmniMoeForConditionalGeneration": Qwen3OmniMoeForConditionalGeneration,
                "Qwen3OmniMoeProcessor": Qwen3OmniMoeProcessor,
            }
            QWEN_UTILS = {"process_mm_info": process_mm_info}
        except ImportError as e:
            print(f"Error: Missing required dependencies: {e}", file=sys.stderr)
            print("\nPlease install required packages:", file=sys.stderr)
            print(
                "  pip install git+https://github.com/huggingface/transformers.git",
                file=sys.stderr,
            )
            print("  pip install qwen-omni-utils audioread", file=sys.stderr)
            sys.exit(1)
    return TORCH, TRANSFORMERS, QWEN_UTILS


# Configuration
MODEL_NAME = "Qwen/Qwen3-Omni-30B-A3B-Instruct"
DEFAULT_CACHE_DIR = Path(__file__).parent / "models"

# Analysis prompt requesting structured JSON output
ANALYSIS_PROMPT = """Analyze this audio track and provide a detailed assessment in JSON format.

Rate the following metrics on a scale of 0-100:
- production_quality: Professional studio production vs amateur/lo-fi
- danceability: High-energy, danceable track vs ambient/calm/non-danceable
- temperament: Bright, happy, uplifting vs dark, moody, melancholic

Also provide:
- genre: The detected genre and sub-genre (be specific, e.g., "Tech House", "Melodic Techno", "Drum & Bass")
- description: A brief 1-2 sentence description of the track's character, mood, and key features

Respond ONLY with a valid JSON object in this exact format:
{
    "production_quality": <0-100>,
    "danceability": <0-100>,
    "temperament": <0-100>,
    "genre": "<genre/sub-genre>",
    "description": "<brief description>"
}

Do not include any other text, markdown, or explanations outside the JSON."""


def get_cache_dir() -> Path:
    """Get the local model cache directory."""
    cache_dir = Path(os.environ.get("BEATSCOUT_MODEL_CACHE", DEFAULT_CACHE_DIR))
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def load_model(cache_dir: Path | None = None, verbose: bool = False):
    """
    Load the Qwen3-Omni model and processor.

    The model is downloaded from HuggingFace Hub on first run and cached locally.
    Subsequent runs load from the local cache for faster startup.

    Args:
        cache_dir: Directory to cache model files (default: ./models/)
        verbose: Print loading information

    Returns:
        Tuple of (model, processor, device)

    How to use the model:
        1. Import dependencies:
           torch, TRANSFORMERS, QWEN_UTILS = _import_dependencies()
           Qwen3OmniMoeForConditionalGeneration = TRANSFORMERS['Qwen3OmniMoeForConditionalGeneration']
           Qwen3OmniMoeProcessor = TRANSFORMERS['Qwen3OmniMoeProcessor']
           process_mm_info = QWEN_UTILS['process_mm_info']

        2. Prepare messages with audio and text:
           messages = [
               {
                   "role": "user",
                   "content": [
                       {"type": "audio", "audio": audio_path},
                       {"type": "text", "text": prompt},
                   ]
               }
           ]

        3. Process with processor:
           text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
           audios, images, videos = process_mm_info(messages, use_audio_in_video=True)
           inputs = processor(
               text=text,
               audios=audios,
               images=images,
               videos=videos,
               return_tensors="pt",
               padding=True,
           )
           inputs = inputs.to(model.device)

        4. Generate output:
           outputs = model.generate(**inputs, max_new_tokens=256, use_cache=True)
           response = processor.batch_decode(outputs, skip_special_tokens=True)
    """
    # Import dependencies
    torch, TRANSFORMERS, _ = _import_dependencies()
    Qwen3OmniMoeForConditionalGeneration = TRANSFORMERS[
        "Qwen3OmniMoeForConditionalGeneration"
    ]
    Qwen3OmniMoeProcessor = TRANSFORMERS["Qwen3OmniMoeProcessor"]

    if cache_dir is None:
        cache_dir = get_cache_dir()

    model_path = cache_dir / MODEL_NAME.replace("/", "--")

    if verbose:
        print(f"Loading Qwen3-Omni model...")
        print(f"  Model: {MODEL_NAME}")
        print(f"  Cache directory: {cache_dir}")
        print(f"  Local path: {model_path}")
        print()

    # Detect device
    if torch.cuda.is_available():
        device = "cuda"
        device_map = "auto"
        if verbose:
            print(f"  Using CUDA device")
    elif torch.backends.mps.is_available():
        device = "mps"
        device_map = "auto"
        if verbose:
            print(f"  Using MPS (Apple Silicon)")
    else:
        device = "cpu"
        device_map = None
        if verbose:
            print(f"  WARNING: Using CPU (this will be very slow)")

    if verbose:
        print()
        print("Downloading/loading model (first run may take several minutes)...")

    try:
        # Load model with local cache - this ensures model files are saved locally
        model = Qwen3OmniMoeForConditionalGeneration.from_pretrained(
            MODEL_NAME,
            device_map=device_map,
            torch_dtype="auto",
            trust_remote_code=True,
            cache_dir=str(cache_dir),
        )

        processor = Qwen3OmniMoeProcessor.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
            cache_dir=str(cache_dir),
        )

        if verbose:
            print(f"  Model loaded successfully on {device}")
            print()

        return model, processor, device

    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        print("\nTroubleshooting:", file=sys.stderr)
        print("  1. Ensure you have enough disk space (~15GB)", file=sys.stderr)
        print(
            "  2. Update transformers: pip install git+https://github.com/huggingface/transformers.git",
            file=sys.stderr,
        )
        print("  3. Check internet connection for first-time download", file=sys.stderr)
        raise


def parse_json_response(text: str) -> dict[str, Any]:
    """
    Parse JSON from model response, handling various formatting issues.

    The model might return:
    - Clean JSON: {"production_quality": 75, ...}
    - Markdown-wrapped: ```json\n{...}\n```
    - With extra text before/after

    This function attempts to extract and parse the JSON object.
    """
    # Try to extract JSON from markdown code blocks
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    # Try to find JSON object directly
    json_match = re.search(r'(\{[^{}]*"production_quality"[^{}]*\})', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        # Try to fix common issues
        text = text.strip()
        if text.startswith("'") and text.endswith("'"):
            text = text[1:-1]

        # Remove any trailing commas before closing braces
        text = re.sub(r",\s*}", "}", text)
        text = re.sub(r",\s*]", "]", text)

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            raise ValueError(f"Could not parse JSON from response: {text[:200]}...")


def analyse_with_qwen3(
    audio_path: Path,
    model,
    processor,
    verbose: bool = False,
) -> dict[str, Any]:
    """
    Analyze an audio file using Qwen3-Omni.

    Args:
        audio_path: Path to the audio file to analyze
        model: Loaded Qwen3-Omni model (Qwen3OmniMoeForConditionalGeneration)
        processor: Loaded Qwen3-Omni processor (Qwen3OmniMoeProcessor)
        verbose: Print processing information

    Returns:
        Dictionary containing:
            - production_quality: int (0-100)
            - danceability: int (0-100)
            - temperament: int (0-100)
            - genre: str
            - description: str
            - raw_response: str (original model output)
    """
    # Import dependencies
    torch, _, QWEN_UTILS = _import_dependencies()
    process_mm_info = QWEN_UTILS["process_mm_info"]

    if verbose:
        print(f"Processing audio: {audio_path}")

    # Prepare messages in the format expected by Qwen3-Omni
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "audio", "audio": str(audio_path)},
                {"type": "text", "text": ANALYSIS_PROMPT},
            ],
        }
    ]

    if verbose:
        print("  Preparing multimodal inputs...")

    # Process multimodal information
    text = processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    # Extract audio, image, and video information from messages
    audios, images, videos = process_mm_info(messages, use_audio_in_video=True)

    # Prepare inputs for the model
    inputs = processor(
        text=text,
        audios=audios,
        images=images,
        videos=videos,
        return_tensors="pt",
        padding=True,
    )

    # Move inputs to same device as model
    inputs = inputs.to(model.device)

    if verbose:
        print("  Running inference (this may take a while)...")

    # Generate response
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            use_cache=True,
        )

    # Decode response
    response = processor.batch_decode(outputs, skip_special_tokens=True)[0]

    if verbose:
        print(f"  Raw response received ({len(response)} chars)")
        print("  Parsing results...")

    # Parse JSON response
    try:
        result = parse_json_response(response)
        result["raw_response"] = response

        # Validate required fields
        required_fields = [
            "production_quality",
            "danceability",
            "temperament",
            "genre",
            "description",
        ]
        for field in required_fields:
            if field not in result:
                result[field] = None

        return result

    except ValueError as e:
        if verbose:
            print(f"  Warning: Failed to parse JSON, returning raw response")

        # Return partial result with raw response
        return {
            "production_quality": None,
            "danceability": None,
            "temperament": None,
            "genre": None,
            "description": None,
            "error": str(e),
            "raw_response": response,
        }


def format_output(result: dict[str, Any], json_output: bool = False) -> str:
    """Format analysis results for display."""
    if json_output:
        return json.dumps(result, indent=2)

    lines = [
        "=" * 60,
        "Qwen3-Omni Audio Analysis Results",
        "=" * 60,
        "",
    ]

    # Scores
    if result.get("production_quality") is not None:
        lines.append(f"Production Quality: {result['production_quality']}/100")
    if result.get("danceability") is not None:
        lines.append(f"Danceability:       {result['danceability']}/100")
    if result.get("temperament") is not None:
        lines.append(f"Temperament:        {result['temperament']}/100")

    lines.append("")

    # Genre and description
    if result.get("genre"):
        lines.append(f"Genre:              {result['genre']}")
    if result.get("description"):
        lines.append(f"Description:        {result['description']}")

    # Error info if present
    if result.get("error"):
        lines.append("")
        lines.append(f"Warning: {result['error']}")

    lines.append("")
    lines.append("=" * 60)

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Analyze audio tracks using Qwen3-Omni multimodal model.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Metrics:
  production_quality  - Professional vs amateur production (0-100)
  danceability        - Danceable energetic vs ambient calm (0-100)
  temperament         - Bright happy vs dark moody (0-100)
  genre               - Detected genre/sub-genre
  description         - Brief description of track character

Model Cache:
  Models are cached in ./models/ by default.
  Set BEATSCOUT_MODEL_CACHE environment variable to change location.

Examples:
  python analyse_qwen3.py resources/example.mp3
  python analyse_qwen3.py resources/track.wav --json
  python analyse_qwen3.py song.mp3 --verbose --json > results.json
        """,
    )

    parser.add_argument(
        "audio_file",
        type=str,
        help="Path to audio file to analyze (mp3, wav, flac, etc.)",
    )

    parser.add_argument(
        "--cache-dir",
        type=str,
        default=None,
        help="Directory to cache model files (default: ./models/)",
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON instead of formatted text",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Print detailed processing information",
    )

    args = parser.parse_args()

    # Validate audio file
    audio_path = Path(args.audio_file)
    if not audio_path.exists():
        print(f"Error: Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    # Resolve cache directory
    cache_dir = Path(args.cache_dir) if args.cache_dir else get_cache_dir()
    cache_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Load model (cached locally after first download)
        model, processor, device = load_model(cache_dir, verbose=args.verbose)

        # Analyze audio
        result = analyse_with_qwen3(
            audio_path=audio_path,
            model=model,
            processor=processor,
            verbose=args.verbose,
        )

        # Output results
        print(format_output(result, json_output=args.json))

    except KeyboardInterrupt:
        print("\n\nAnalysis interrupted by user.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\nError during analysis: {e}", file=sys.stderr)
        if args.verbose:
            import traceback

            traceback.print_exc()
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
