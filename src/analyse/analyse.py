"""
Analysis orchestrator for BeatScout.

This module provides the high-level analysis API, coordinating different
analysis models (currently MuQ-MuLan, future: Essentia) and managing result formatting.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .analyse_muq_mulan import MuqMulanAnalyser, DEFAULT_MAX_DURATION_SEC


# =============================================================================
# Analysis Result
# =============================================================================


@dataclass
class AnalysisResult:
    """
    Complete analysis result for a single track.

    This dataclass holds all scoring results from different analysis models,
    along with metadata about the analysis run.

    Attributes:
        audio_path: Path to the analyzed audio file
        scores: Dict of metric scores (0.0-1.0 scale)
        duration_sec: Actual duration of audio analyzed
        sample_rate: Sample rate used for analysis (always 24000 for MuQ-MuLan)
        analysis_time_ms: Time in milliseconds to complete the analysis
        metadata: Additional optional metadata (e.g., file format, size)

    Example:
        >>> result = engine.analyse_track("track.mp3")
        >>> print(result.scores)
        {'production_quality': 0.7250, 'danceability': 0.8500, 'temperament': 0.6030}
    """

    audio_path: str
    scores: dict[str, float]
    duration_sec: float
    sample_rate: int = 24000
    analysis_time_ms: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary for JSON serialization."""
        return {
            "audio_path": self.audio_path,
            "scores": self.scores,
            "duration_sec": self.duration_sec,
            "sample_rate": self.sample_rate,
            "analysis_time_ms": self.analysis_time_ms,
            "metadata": self.metadata,
        }

    def __str__(self) -> str:
        """Pretty-print the analysis result."""
        lines = [
            f"Analysis Result for: {self.audio_path}",
            f"Duration Analyzed: {self.duration_sec:.1f}s",
            "",
            "Scores:",
        ]
        for metric_name, score in self.scores.items():
            lines.append(f"  {metric_name}: {score:.4f}")
        return "\n".join(lines)


# =============================================================================
# Analysis Engine
# =============================================================================


class AnalysisEngine:
    """
    Main analysis engine that orchestrates all analysis models.

    Currently supports MuQ-MuLan-based scoring. Designed to easily incorporate
    additional analysis models in the future (e.g., Essentia for BPM/key).

    Example:
        >>> engine = AnalysisEngine()
        >>> result = engine.analyse_track("track.mp3")
        >>> print(result)
        Analysis Result for: track.mp3
        Duration Analyzed: 60.0s

        Scores:
          production_quality: 0.7250
          danceability: 0.8500
          temperament: 0.6030
    """

    def __init__(
        self,
        device: str | None = None,
        max_duration_sec: float = DEFAULT_MAX_DURATION_SEC,
    ):
        """
        Initialize the analysis engine with all models.

        Args:
            device: torch device ('cuda', 'mps', 'cpu').
                Defaults to best available.
            max_duration_sec: Maximum audio duration to analyze.
                Default 60s for efficiency.
        """
        self.muq_analyser = MuqMulanAnalyser(device=device)
        self.max_duration_sec = max_duration_sec

    def analyse_track(self, audio_path: str | Path) -> AnalysisResult:
        """
        Analyze a single track through all analysis models.

        This is the main entry point for track analysis. It runs all
        configured models (currently just MuQ-MuLan) and returns a unified result.

        Args:
            audio_path: Path to audio file (mp3, wav, flac, etc.)

        Returns:
            AnalysisResult containing all scores and metadata.

        Raises:
            FileNotFoundError: If audio file doesn't exist
            ValueError: If audio file is corrupted or unreadable

        Example:
            >>> engine = AnalysisEngine()
            >>> result = engine.analyse_track("resources/example.mp3")
            >>> print(result.scores['danceability'])
            0.8500
        """
        import time

        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        start_time = time.perf_counter()

        # Run MuQ-MuLan analysis
        scores = self.muq_analyser.analyse(
            audio_path, max_duration_sec=self.max_duration_sec
        )

        end_time = time.perf_counter()
        analysis_time_ms = (end_time - start_time) * 1000

        # Get file metadata
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)

        return AnalysisResult(
            audio_path=str(audio_path),
            scores=scores,
            duration_sec=self.max_duration_sec,
            analysis_time_ms=round(analysis_time_ms, 1),
            metadata={
                "file_size_mb": round(file_size_mb, 2),
                "file_format": audio_path.suffix.lower(),
            },
        )

    def analyse_batch(self, audio_paths: list[str | Path]) -> list[AnalysisResult]:
        """
        Analyze multiple tracks sequentially.

        Note: This is NOT parallel. The MuQ-MuLan model is not thread-safe,
        and we process files sequentially to avoid memory issues with
        the 1.2GB model.

        For parallel processing, create separate AnalysisEngine instances
        in different worker processes.

        Args:
            audio_paths: List of paths to audio files

        Returns:
            List of AnalysisResult objects, one per input file
        """
        results = []
        for path in audio_paths:
            try:
                result = self.analyse_track(path)
                results.append(result)
            except Exception as e:
                # Log error but continue processing other files
                print(f"Error analyzing {path}: {e}")
                # Create error result
                results.append(
                    AnalysisResult(
                        audio_path=str(path),
                        scores={},
                        duration_sec=0.0,
                        metadata={"error": str(e)},
                    )
                )
        return results


# =============================================================================
# Convenience Functions
# =============================================================================

# Global engine instance (lazy initialization)
_global_engine: AnalysisEngine | None = None


def analyse_track(audio_path: str | Path, **kwargs) -> AnalysisResult:
    """
        Convenience function to analyze a single track.

        Uses a global AnalysisEngine instance (lazy-initialized) to avoid
        reloading the model on every call.

        Args:
            audio_path: Path to audio file
            **kwargs: Additional arguments passed to AnalysisEngine.analyse_track

        Returns:
            AnalysisResult containing all scores and metadata.

    Example:
                >>> result = analyse_track("track.mp3")
                >>> print(result.scores)
                {'production_quality': 0.7250, 'danceability': 0.8500, 'temperament': 0.6030}
    """
    global _global_engine

    if _global_engine is None:
        _global_engine = AnalysisEngine()

    return _global_engine.analyse_track(audio_path, **kwargs)


def get_engine() -> AnalysisEngine:
    """
    Get or create the global AnalysisEngine instance.

    Useful when you need to analyze multiple files efficiently
    without reloading the model.

    Returns:
        The global AnalysisEngine instance
    """
    global _global_engine

    if _global_engine is None:
        _global_engine = AnalysisEngine()

    return _global_engine
