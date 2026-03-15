#!/usr/bin/env python3
"""
BeatScout Batch Audio Analysis Script

Analyzes all audio files in example_songs/ directory and outputs
normalized scores to example_data.json.

Usage:
    python analyze_batch.py

Output:
    example_data.json with normalized 0-100 integer scores per song
"""

from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import torch

# Optimize CPU parallelism for single-process execution
torch.set_num_threads(8)

import sys

sys.path.insert(0, str(Path(__file__).parent))

from src.analyse import AnalysisEngine, AnalysisResult


EXAMPLE_SONGS_DIR = Path(__file__).parent / "example_songs"
OUTPUT_FILE = Path(__file__).parent / "example_data.json"
METRIC_NAMES = ["production_quality", "danceability", "temperament"]


def find_audio_files(directory: Path) -> list[Path]:
    """Find all audio files in the given directory."""
    audio_extensions = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}
    files = []
    for f in directory.iterdir():
        if f.is_file() and f.suffix.lower() in audio_extensions:
            files.append(f)
    return sorted(files)


def normalize_scores(
    raw_results: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, dict[str, float]]]:
    """
    Normalize raw 0-1 scores to 0-100 integers using min-max scaling.

    Returns:
        Tuple of (normalized_results, normalization_params)
        normalization_params contains min/max values used for each metric
    """
    # Collect all scores per metric
    metric_scores: dict[str, list[float]] = {name: [] for name in METRIC_NAMES}

    for result in raw_results:
        for metric in METRIC_NAMES:
            if metric in result["raw_scores"]:
                metric_scores[metric].append(result["raw_scores"][metric])

    # Calculate min/max for each metric
    norm_params: dict[str, dict[str, float]] = {}
    for metric in METRIC_NAMES:
        scores = metric_scores[metric]
        if scores:
            norm_params[metric] = {
                "min": min(scores),
                "max": max(scores),
                "raw_range": max(scores) - min(scores),
            }
        else:
            norm_params[metric] = {"min": 0.0, "max": 1.0, "raw_range": 1.0}

    # Normalize each result
    normalized_results = []
    for result in raw_results:
        normalized: dict[str, Any] = {
            "filename": result["filename"],
            "file_size_mb": result["file_size_mb"],
            "file_format": result["file_format"],
            "analysis_time_ms": result["analysis_time_ms"],
            "raw_scores": result["raw_scores"],
            "normalized_scores": {},
        }

        for metric in METRIC_NAMES:
            raw_score = result["raw_scores"].get(metric)
            if raw_score is not None:
                min_val = norm_params[metric]["min"]
                max_val = norm_params[metric]["max"]
                raw_range = max_val - min_val

                if raw_range > 0:
                    normalized_val = (raw_score - min_val) / raw_range
                else:
                    normalized_val = 0.5

                normalized["normalized_scores"][metric] = round(normalized_val * 100)

        normalized_results.append(normalized)

    return normalized_results, norm_params


def analyze_all_songs(files: list[Path], verbose: bool = True) -> list[dict[str, Any]]:
    """
    Analyze all songs and return raw results.

    Args:
        files: List ofaudio file paths
        verbose: Whether to print progress

    Returns:
        List of raw analysis results
    """
    engine = AnalysisEngine()
    raw_results: list[dict[str, Any]] = []

    total = len(files)
    for idx, audio_path in enumerate(files, 1):
        if verbose:
            print(f"[{idx}/{total}] Analyzing: {audio_path.name}")

        try:
            result = engine.analyse_track(audio_path)
            raw_results.append(
                {
                    "filename": audio_path.name,
                    "file_size_mb": result.metadata.get("file_size_mb"),
                    "file_format": result.metadata.get("file_format"),
                    "analysis_time_ms": result.analysis_time_ms,
                    "raw_scores": dict(result.clap_scores),
                }
            )
        except Exception as e:
            print(f"  ERROR: {e}")
            raw_results.append(
                {
                    "filename": audio_path.name,
                    "file_size_mb": None,
                    "file_format": audio_path.suffix.lower(),
                    "analysis_time_ms": None,
                    "raw_scores": {},
                    "error": str(e),
                }
            )

    return raw_results


def main():
    """Main entry point for batch analysis."""
    print("=" * 60)
    print("BeatScout Batch Analysis")
    print("=" * 60)

    # Find audio files
    print(f"\nScanning: {EXAMPLE_SONGS_DIR}")
    files = find_audio_files(EXAMPLE_SONGS_DIR)

    if not files:
        print("ERROR: No audio files found in example_songs/")
        return

    print(f"Found {len(files)} audio files\n")

    # Analyze all songs
    start_time = time.perf_counter()
    raw_results = analyze_all_songs(files, verbose=True)
    elapsed = time.perf_counter() - start_time

    print(f"\nAnalysis complete in {elapsed:.1f} seconds")
    print(f"Average: {elapsed / len(files):.2f}s per file")

    # Normalize scores
    print("\nNormalizing scores...")
    normalized_results, norm_params = normalize_scores(raw_results)

    # Build output JSON
    output: dict[str, Any] = {
        "metadata": {
            "total_songs": len(files),
            "successful_analyses": sum(1 for r in raw_results if "error" not in r),
            "failed_analyses": sum(1 for r in raw_results if "error" in r),
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "processing_time_sec": round(elapsed, 2),
            "normalization_params": norm_params,
        },
        "songs": normalized_results,
    }

    # Write to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nOutput written to: {OUTPUT_FILE}")
    print(f"Total songs: {output['metadata']['total_songs']}")
    print(f"Successful: {output['metadata']['successful_analyses']}")
    print(f"Failed: {output['metadata']['failed_analyses']}")


if __name__ == "__main__":
    main()
