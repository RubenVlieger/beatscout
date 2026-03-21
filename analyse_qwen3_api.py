#!/usr/bin/env python3
"""
BeatScout Qwen3-Omni Audio Analysis CLI (DashScope API Version)

Analyze audio tracks for danceability, temperament, and production quality
using the Qwen3-Omni multimodal model via Alibaba Cloud's DashScope API.

This is the API version that works on Intel Macs (no local GPU/PyTorch required).

Usage:
    python analyse_qwen3_api.py <audio_file> [--json] [--verbose]
    python analyse_qwen3_api.py resources/example.mp3
    python analyse_qwen3_api.py resources/track.wav --json --verbose

Setup:
    1. Get API Key from Alibaba Cloud (https://bailian.console.aliyun.com/?tab=api-key)
    2. Add to .env file: DASHSCOPE_API_KEY=your_api_key_here
    3. Or set environment variable: export DASHSCOPE_API_KEY=your_api_key_here

API Information:
    - Service: Alibaba Cloud DashScope (Model Studio)
    - Model: qwen3-omni-flash
    - Region: Beijing (default, has free tier) or Singapore
    - Free Tier: 1M tokens (Beijing region, 90 days after activation)
    - Audio Limits: 100MB, 20 minutes max

Hardware Requirements:
    - None! Runs entirely on Alibaba Cloud's infrastructure
    - Works on Intel Macs, ARM Macs, Linux, Windows

Dependencies:
    - openai>=1.52.0 (OpenAI-compatible client)
    - python-dotenv (for .env file loading)

Output:
    Returns JSON with production_quality, danceability, temperament scores (0-100),
    plus genre and description fields.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import re
import sys
import time
import traceback
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# Try to import optional dependencies
try:
    from openai import OpenAI, APIError, RateLimitError, Timeout
except ImportError:
    print("Error: openai package not found.", file=sys.stderr)
    print("\nPlease install required package:", file=sys.stderr)
    print("  pip install openai>=1.52.0", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass  # .env loading is optional

# Configuration
DEFAULT_MODEL = "qwen3-omni-flash"
DEFAULT_REGION = "beijing"
MAX_FILE_SIZE_MB = 100
MAX_AUDIO_DURATION_MIN = 20

# Beijing region (has free tier)
BEIJING_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
# Singapore region (international, no free tier)
SINGAPORE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

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


class APIKeyError(Exception):
    """Raised when API key is missing or invalid."""

    pass


class AudioFileError(Exception):
    """Raised when audio file is invalid (wrong format, too large, etc.)."""

    pass


def get_api_key() -> str:
    """
    Get DashScope API key from environment or .env file.

    Returns:
        API key string

    Raises:
        APIKeyError: If API key is not found
    """
    api_key = os.environ.get("DASHSCOPE_API_KEY")

    if not api_key:
        raise APIKeyError(
            "DASHSCOPE_API_KEY not found.\n\n"
            "To get an API key:\n"
            "  1. Visit: https://bailian.console.aliyun.com/?tab=api-key\n"
            "  2. Create an API key (Beijing region for free tier)\n"
            "  3. Add to .env file: DASHSCOPE_API_KEY=your_api_key\n"
            "  4. Or set environment variable: export DASHSCOPE_API_KEY=your_api_key"
        )

    return api_key


def get_base_url(region: str) -> str:
    """
    Get the appropriate base URL for the specified region.

    Args:
        region: Either "beijing" or "singapore"

    Returns:
        Base URL for API endpoint
    """
    if region.lower() == "singapore":
        return SINGAPORE_BASE_URL
    return BEIJING_BASE_URL


def validate_audio_file(audio_path: Path) -> tuple[str, int]:
    """
    Validate audio file exists and meets requirements.

    Args:
        audio_path: Path to audio file

    Returns:
        Tuple of (file_format, file_size_bytes)

    Raises:
        AudioFileError: If file is invalid
    """
    if not audio_path.exists():
        raise AudioFileError(f"Audio file not found: {audio_path}")

    if not audio_path.is_file():
        raise AudioFileError(f"Path is not a file: {audio_path}")

    # Check file size
    file_size = audio_path.stat().st_size
    file_size_mb = file_size / (1024 * 1024)

    if file_size_mb > MAX_FILE_SIZE_MB:
        raise AudioFileError(
            f"Audio file too large: {file_size_mb:.1f}MB (max {MAX_FILE_SIZE_MB}MB)\n"
            f"Consider trimming to {MAX_AUDIO_DURATION_MIN} minutes or less."
        )

    # Detect format from extension or mime type
    file_format = audio_path.suffix.lower().lstrip(".")
    mime_type, _ = mimetypes.guess_type(str(audio_path))

    if mime_type:
        # Extract format from mime type (e.g., "audio/mpeg" -> "mp3")
        mime_format = mime_type.split("/")[-1]
        if mime_format in ["mpeg", "mp3"]:
            file_format = "mp3"
        elif mime_format in ["wav", "x-wav"]:
            file_format = "wav"
        elif mime_format in ["flac"]:
            file_format = "flac"
        elif mime_format in ["aac"]:
            file_format = "aac"
        elif mime_format in ["ogg"]:
            file_format = "ogg"

    # Map common extensions
    format_map = {
        "mp3": "mp3",
        "wav": "wav",
        "flac": "flac",
        "aac": "aac",
        "ogg": "ogg",
        "oga": "ogg",
        "m4a": "m4a",
        "wma": "wma",
        "amr": "amr",
        "3gp": "3gp",
    }

    file_format = format_map.get(file_format, file_format)

    # Validate supported formats
    supported_formats = [
        "mp3",
        "wav",
        "flac",
        "aac",
        "ogg",
        "m4a",
        "wma",
        "amr",
        "3gp",
        "3gpp",
    ]
    if file_format.lower() not in supported_formats:
        raise AudioFileError(
            f"Unsupported audio format: {file_format}\n"
            f"Supported formats: {', '.join(supported_formats)}"
        )

    return file_format, file_size


def encode_audio_to_base64(audio_path: Path) -> str:
    """
    Encode audio file to base64 string.

    Args:
        audio_path: Path to audio file

    Returns:
        Base64-encoded audio data
    """
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    return base64.b64encode(audio_bytes).decode("utf-8")


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
    except json.JSONDecodeError:
        # Try to fix common issues
        text = text.strip()
        if text.startswith("'") and text.endswith("'"):
            text = text[1:-1]

        # Remove any trailing commas before closing braces
        text = re.sub(r",\s*}", "}", text)
        text = re.sub(r",\s*]", "]", text)

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"Could not parse JSON from response: {text[:200]}..."
            ) from e


def create_dashscope_client(api_key: str, base_url: str) -> OpenAI:
    """
    Create OpenAI-compatible client for DashScope API.

    Args:
        api_key: DashScope API key
        base_url: API base URL

    Returns:
        OpenAI client instance
    """
    return OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=300.0,  # 5 minute timeout for audio processing
    )


def analyse_audio_with_qwen3(
    audio_path: Path,
    client: OpenAI,
    model: str = DEFAULT_MODEL,
    verbose: bool = False,
) -> dict[str, Any]:
    """
    Analyze an audio file using Qwen3-Omni via DashScope API.

    Args:
        audio_path: Path to the audio file to analyze
        client: OpenAI-compatible client for DashScope
        model: Model name to use (default: qwen3-omni-flash)
        verbose: Print processing information

    Returns:
        Dictionary containing:
            - production_quality: int (0-100)
            - danceability: int (0-100)
            - temperament: int (0-100)
            - genre: str
            - description: str
            - raw_response: str (original model output)
            - usage: dict (token usage info)
    """
    # Validate and encode audio file
    file_format, file_size = validate_audio_file(audio_path)

    if verbose:
        print(f"Processing audio: {audio_path}")
        print(f"  Format: {file_format}")
        print(f"  Size: {file_size / (1024 * 1024):.2f} MB")
        print(f"  Encoding to base64...")

    audio_base64 = encode_audio_to_base64(audio_path)

    if verbose:
        print(f"  Sending to DashScope API...")
        print(f"  Model: {model}")

    try:
        # Make API request
        start_time = time.time()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": audio_base64,
                                "format": file_format,
                            },
                        },
                        {"type": "text", "text": ANALYSIS_PROMPT},
                    ],
                }
            ],
            # Only request text output (we don't need audio for analysis)
            modalities=["text"],
            # Must use streaming for Qwen-Omni
            stream=True,
            stream_options={"include_usage": True},
        )

        if verbose:
            print(f"  Streaming response...")

        # Collect streaming response
        full_text = ""
        usage_info = None

        for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                full_text += chunk.choices[0].delta.content

            # Get usage info from final chunk
            if hasattr(chunk, "usage") and chunk.usage:
                usage_info = {
                    "prompt_tokens": chunk.usage.prompt_tokens,
                    "completion_tokens": chunk.usage.completion_tokens,
                    "total_tokens": chunk.usage.total_tokens,
                }

        elapsed_time = time.time() - start_time

        if verbose:
            print(f"  Response received in {elapsed_time:.2f}s")
            print(f"  Parsing results...")

        # Parse JSON response
        try:
            result = parse_json_response(full_text)
            result["raw_response"] = full_text
            result["usage"] = usage_info
            result["elapsed_time_ms"] = int(elapsed_time * 1000)

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

            return {
                "production_quality": None,
                "danceability": None,
                "temperament": None,
                "genre": None,
                "description": None,
                "error": str(e),
                "raw_response": full_text,
                "usage": usage_info,
                "elapsed_time_ms": int(elapsed_time * 1000),
            }

    except RateLimitError as e:
        raise APIKeyError(
            f"Rate limit exceeded: {e}\n\n"
            "The API has rate limits. Please wait a moment and try again.\n"
            "Free tier: 1 request per second\n"
            "Paid tier: Higher limits available"
        ) from e

    except Timeout as e:
        raise APIKeyError(
            f"Request timeout: {e}\n\n"
            "The audio file may be too large or the API is experiencing high load.\n"
            "Try with a shorter audio clip (under 5 minutes)."
        ) from e

    except APIError as e:
        if "authentication" in str(e).lower() or "api key" in str(e).lower():
            raise APIKeyError(
                f"API authentication failed: {e}\n\n"
                "Please check your DASHSCOPE_API_KEY:\n"
                "  1. Ensure the key is correct\n"
                "  2. Check that the key is for the correct region (Beijing/Singapore)\n"
                "  3. Verify the key hasn't expired"
            ) from e
        raise


def format_output(result: dict[str, Any], json_output: bool = False) -> str:
    """Format analysis results for display."""
    if json_output:
        return json.dumps(result, indent=2, ensure_ascii=False)

    lines = [
        "=" * 60,
        "Qwen3-Omni Audio Analysis Results (DashScope API)",
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

    # Usage info
    if result.get("usage"):
        lines.append("")
        lines.append("API Usage:")
        usage = result["usage"]
        lines.append(f"  Prompt tokens:    {usage.get('prompt_tokens', 'N/A')}")
        lines.append(f"  Completion:       {usage.get('completion_tokens', 'N/A')}")
        lines.append(f"  Total:            {usage.get('total_tokens', 'N/A')}")

    # Timing
    if result.get("elapsed_time_ms"):
        lines.append(f"  Elapsed time:     {result['elapsed_time_ms']}ms")

    # Error info if present
    if result.get("error"):
        lines.append("")
        lines.append(f"Warning: {result['error']}")

    lines.append("")
    lines.append("=" * 60)

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Analyze audio tracks using Qwen3-Omni via DashScope API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Metrics:
  production_quality  - Professional vs amateur production (0-100)
  danceability        - Danceable energetic vs ambient calm (0-100)
  temperament         - Bright happy vs dark moody (0-100)
  genre               - Detected genre/sub-genre
  description         - Brief description of track character

API Setup:
  1. Get API Key: https://bailian.console.aliyun.com/?tab=api-key
  2. Add to .env: DASHSCOPE_API_KEY=your_api_key_here
  3. Beijing region has 1M free tokens (90 days)

Audio Requirements:
  - Max file size: 100MB
  - Max duration: 20 minutes
  - Supported formats: mp3, wav, flac, aac, ogg, m4a, wma, amr, 3gp

Examples:
  python analyse_qwen3_api.py resources/example.mp3
  python analyse_qwen3_api.py song.mp3 --json
  python analyse_qwen3_api.py track.wav --verbose --json
  python analyse_qwen3_api.py song.mp3 --region singapore  # Use Singapore region
        """,
    )

    parser.add_argument(
        "audio_file",
        type=str,
        help="Path to audio file to analyze (mp3, wav, flac, etc.)",
    )

    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Model name to use (default: {DEFAULT_MODEL})",
    )

    parser.add_argument(
        "--region",
        type=str,
        choices=["beijing", "singapore"],
        default=DEFAULT_REGION,
        help=f"API region (default: {DEFAULT_REGION}, beijing has free tier)",
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

    # Get API key
    try:
        api_key = get_api_key()
    except APIKeyError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Validate audio file path
    audio_path = Path(args.audio_file)

    try:
        validate_audio_file(audio_path)
    except AudioFileError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Create API client
    base_url = get_base_url(args.region)
    client = create_dashscope_client(api_key, base_url)

    if args.verbose:
        print(f"BeatScout Qwen3-Omni Analysis (DashScope API)")
        print(f"=" * 60)
        print(f"Region: {args.region}")
        print(f"Base URL: {base_url}")
        print(f"Model: {args.model}")
        print()

    # Analyze audio
    try:
        result = analyse_audio_with_qwen3(
            audio_path=audio_path,
            client=client,
            model=args.model,
            verbose=args.verbose,
        )

        # Output results
        print(format_output(result, json_output=args.json))

    except KeyboardInterrupt:
        print("\n\nAnalysis interrupted by user.", file=sys.stderr)
        sys.exit(130)
    except APIKeyError as e:
        print(f"\nError: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nError during analysis: {e}", file=sys.stderr)
        if args.verbose:
            traceback.print_exc()
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
