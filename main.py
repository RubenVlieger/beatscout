#!/usr/bin/env python3
"""
BeatScout Audio Analysis CLI

Analyze audio tracks for danceability, temperament, and production quality
using CLAP-based semantic scoring.

Usage:
    python main.py <audio_file> [--model <model_path>] [--device <device>]

    python main.py --list-devices  # Show available devices

Examples:
    python main.py resources/example.mp3
    python main.py resources/track.wav --device cuda --model models/music_audioset.pt
    python main.py resources/test.mp3 --verbose

Platform Support:
    Linux:   CUDA (NVIDIA), ROCm (AMD), CPU
    macOS:   MPS (Apple Silicon), CPU
    Windows: CUDA (NVIDIA), CPU

Output:
    Prints analysis results including CLAP scores for each metric.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from src.analyse import AnalysisEngine, AnalysisResult
from src.analyse.analyse_clap import get_device_info


def main():
    parser = argparse.ArgumentParser(
        description="Analyze audio tracks using CLAP-based semantic scoring.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Metrics:
  production_quality  - Professional vs amateur production (0.0-1.0)
  danceability        - Danceable energetic vs ambient calm (0.0-1.0)
  temperament         - Bright happy vs dark moody (0.0-1.0)

Platform Notes:
  Linux:   Use --device cuda for NVIDIA/AMD GPUs (ROCm uses 'cuda' device name)
  macOS:   Use --device mps for Apple Silicon, --device cpu for Intel
  Windows: Use --device cuda for NVIDIA GPUs
        """,
    )

    parser.add_argument(
        "audio_file",
        nargs="?",
        type=str,
        help="Path to audio file to analyze (mp3, wav, flac, etc.)",
    )

    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Path to CLAP model checkpoint (default: models/music_audioset_epoch_15_esc_90.14.pt)",
    )

    parser.add_argument(
        "--device",
        type=str,
        choices=["cuda", "mps", "cpu"],
        default=None,
        help="Device to use for inference (default: auto-detect). Note: ROCm uses 'cuda'.",
    )

    parser.add_argument(
        "--max-duration",
        type=float,
        default=60.0,
        help="Maximum duration in seconds to analyze (default: 60.0)",
    )

    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="List available compute devices and exit",
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

    # Handle --list-devices
    if args.list_devices:
        info = get_device_info()
        print("Available Compute Devices")
        print("=" * 50)
        print(f"Platform:        {info['platform']}")
        print(f"Architecture:    {info['architecture']}")
        print(f"Best Device:     {info['best_device']}")
        print()
        print("Device Support:")
        print(f"  CUDA/ROCm:     {'Yes' if info['cuda_available'] else 'No'}")
        print(f"  MPS (macOS):   {'Yes' if info['mps_available'] else 'No'}")
        print()
        if info["gpu_info"]:
            print("Detected GPUs:")
            for gpu in info["gpu_info"]:
                print(f"  - {gpu}")
        else:
            print("No GPUs detected. Using CPU.")
        print()
        print("Usage:")
        print("  python main.py track.mp3 --device cuda  # For NVIDIA/AMD (ROCm)")
        print("  python main.py track.mp3 --device mps   # For Apple Silicon")
        print("  python main.py track.mp3 --device cpu   # Fallback")
        sys.exit(0)

    # Validate audio file
    if not args.audio_file:
        parser.error("audio_file is required (unless using --list-devices)")

    audio_path = Path(args.audio_file)
    if not audio_path.exists():
        print(f"Error: Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        info = get_device_info()
        print(f"Loading CLAP model...")
        if args.model:
            print(f"  Model path: {args.model}")
        print(
            f"  Device: {args.device or info['best_device']} (auto-detect: {info['best_device']})"
        )
        print(f"  Platform: {info['platform']}")
        print(f"Analyzing: {audio_path}")
        print(f"Max duration: {args.max_duration}s")
        print()

    # Initialize engine and analyze
    try:
        engine = AnalysisEngine(
            clap_model_path=args.model,
            device=args.device,
            max_duration_sec=args.max_duration,
        )
        result = engine.analyse_track(audio_path)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error during analysis: {e}", file=sys.stderr)
        import traceback

        if args.verbose:
            traceback.print_exc()
        sys.exit(1)

    # Output results
    if args.json:
        import json

        print(json.dumps(result.to_dict(), indent=2))
    else:
        print(result)
        if args.verbose:
            print(f"\nAnalysis completed in {result.analysis_time_ms:.1f}ms")

    # Exit with success
    sys.exit(0)


if __name__ == "__main__":
    main()
