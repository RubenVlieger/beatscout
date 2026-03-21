"""
MuQ-MuLan-based audio scoring engine for BeatScout.

This module provides the core MuQ-MuLan (Music-Query Music-Language) analysis
functionality, including audio embedding computation and spectrum-based
scoring using natural language text prompts.

About MuQ-MuLan:
    MuQ-MuLan is a music-text contrastive model that aligns music audio with
    natural language descriptions. It was trained on a large-scale dataset of
    music-text pairs and provides better semantic alignment for music-specific
    tasks compared to general audio-language models like CLAP.

    Model: OpenMuQ/MuQ-MuLan-large
    Paper: https://arxiv.org/abs/2410.09263
    HuggingFace: https://huggingface.co/OpenMuQ/MuQ-MuLan-large

How it works:
    1. Audio is loaded at 24kHz and converted to a torch tensor
    2. The MuQ-MuLan model computes embeddings for both audio and text
    3. Similarity between audio and text is computed using calc_similarity()
    4. Spectrum scores are normalized to 0-1 scale

Usage:
    >>> from src.analyse.analyse_muq_mulan import MuqMulanAnalyser
    >>> analyser = MuqMulanAnalyser()
    >>> scores = analyser.analyse("track.mp3")
    >>> print(scores)
    {'production_quality': 0.7250, 'danceability': 0.8500, 'temperament': 0.6030}

Key differences from CLAP:
    - Sample rate: 24kHz (vs 48kHz for CLAP)
    - Model loading: Auto-downloaded from HuggingFace (vs local .pt file)
    - Audio input: torch tensor (1, samples) (vs numpy array)
    - Similarity: Built-in calc_similarity() (vs manual cosine similarity)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import librosa
import torch
from muq import MuQMuLan

if TYPE_CHECKING:
    from numpy.typing import NDArray

# =============================================================================
# Constants
# =============================================================================

DEFAULT_SAMPLE_RATE = 24000  # MuQ-MuLan requires 24kHz
DEFAULT_MAX_DURATION_SEC = 60.0  # Process first 60 seconds for efficiency


def get_device_info() -> dict[str, any]:
    """
    Get detailed information about available compute devices.

    Returns:
        Dictionary with device information including:
        - 'best_device': Always 'cpu' (CPU-only mode)
        - 'cuda_available': False (CPU-only mode)
        - 'mps_available': False (CPU-only mode)
        - 'platform': Current platform (darwin, linux, windows)
        - 'architecture': CPU architecture (arm64, x86_64, etc.)
        - 'gpu_info': Empty list (CPU-only mode)

    Note:
        This project uses CPU-only PyTorch for compatibility and smaller size.
    """
    import platform
    import sys

    return {
        "best_device": "cpu",
        "cuda_available": False,
        "mps_available": False,
        "platform": sys.platform,
        "architecture": platform.machine(),
        "gpu_info": [],
    }


def get_best_device() -> str:
    """
    Returns the device for model inference.

    This project uses CPU-only PyTorch for compatibility and smaller package size.

    Returns:
        Always returns 'cpu'
    """
    return "cpu"


# =============================================================================
# Metric Definitions
# =============================================================================


@dataclass(frozen=True)
class MetricDefinition:
    """
    Defines a spectrum-based MuQ-MuLan metric.

    Each metric is scored on a 0-100 scale by comparing the audio embedding
    against two opposing text prompts (positive and negative poles).

    Attributes:
        name: Machine-readable metric identifier (e.g., 'danceability')
        display_name: Human-readable name for UI display
        positive_prompt: Text describing the "high" end of the spectrum (score ~100)
        negative_prompt: Text describing the "low" end of the spectrum (score ~0)
        description: Brief explanation of what this metric measures
    """

    name: str
    display_name: str
    positive_prompt: str
    negative_prompt: str
    description: str


DEFAULT_METRICS: tuple[MetricDefinition, ...] = (
    MetricDefinition(
        name="production_quality",
        display_name="Production Quality",
        positive_prompt="professional well-mixed high-quality studio production with clear mastering polished sound",
        negative_prompt="amateur bedroom producer distorted poorly mixed low-quality recording muddy sound",
        description="Measures production quality and mixing proficiency",
    ),
    MetricDefinition(
        name="danceability",
        display_name="Danceability",
        positive_prompt="upbeat energetic danceable music with strong groove and rhythm steady beat four-on-the-floor",
        negative_prompt="slow ambient atmospheric calm relaxing music without rhythm soundscape",
        description="Measures how suitable the track is for dancing",
    ),
    MetricDefinition(
        name="temperament",
        display_name="Temperament",
        positive_prompt="bright happy uplifting euphoric positive joyful cheerful energetic music",
        negative_prompt="dark moody melancholic aggressive intense ominous brooding music",
        description="Measures the emotional temperament from bright/happy to dark/moody",
    ),
)


# =============================================================================
# MuQ-MuLan Analyser
# =============================================================================


class MuqMulanAnalyser:
    """
    Singleton MuQ-MuLan analysis engine for computing text-guided audio scores.

    This class manages the MuQ-MuLan model lifecycle (loading once, reusing across calls),
    audio preprocessing, embedding computation, and spectrum-based scoring.

    Thread Safety:
        The underlying MuQ-MuLan model is NOT thread-safe. If parallel processing is needed,
        use a lock or instantiate separate MuqMulanAnalyser instances per worker.

    Memory Usage:
        The MuQ-MuLan-large model requires ~1.2GB memory.

    Example:
        >>> analyser = MuqMulanAnalyser()
        >>> scores = analyser.analyse("track.mp3")
        >>> print(scores)
        {'production_quality': 0.7250, 'danceability': 0.8500, 'temperament': 0.6030}
    """

    _instance: MuqMulanAnalyser | None = None
    _initialized: bool = False

    def __new__(cls, device: str | None = None) -> MuqMulanAnalyser:
        """
        Singleton pattern: ensures the model is loaded only once.

        Args:
            device: torch device ('cuda', 'mps', 'cpu'). Defaults to best available.

        Note:
            The singleton pattern means subsequent instantiations with different
            device will return the already-initialized instance.
            To reload with different settings, delete the instance first:
                del MuqMulanAnalyser._instance
                MuqMulanAnalyser._initialized = False
        """
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, device: str | None = None) -> None:
        """
        Initialize the MuQ-MuLan model.

        This method is safe to call multiple times due to the _initialized flag.
        """
        if MuqMulanAnalyser._initialized:
            return

        # Resolve device
        self.device = device if device else get_best_device()

        # Initialize MuQ-MuLan model
        # Model weights (~1.2GB) are auto-downloaded from HuggingFace on first use
        self.model = MuQMuLan.from_pretrained("OpenMuQ/MuQ-MuLan-large")
        self.model.to(self.device)
        self.model.eval()

        # Store metrics
        self.metrics = DEFAULT_METRICS

        MuqMulanAnalyser._initialized = True

    def load_audio(
        self, audio_path: str | Path, max_duration_sec: float = DEFAULT_MAX_DURATION_SEC
    ) -> torch.Tensor:
        """
        Load and preprocess audio for MuQ-MuLan embedding.

        Processing steps:
        1. Load audio file using librosa
        2. Resample to 24kHz (MuQ-MuLan requirement)
        3. Convert to mono if stereo (average channels)
        4. Truncate to max_duration_sec for efficiency
        5. Convert to torch tensor with shape (1, samples)

        Args:
            audio_path: Path to audio file (mp3, wav, flac, etc. supported by librosa)
            max_duration_sec: Maximum duration to process. Default 60s for efficiency.

        Returns:
            Preprocessed audio as torch tensor of shape (1, samples) for MuQ-MuLan input.

        Raises:
            FileNotFoundError: If audio file doesn't exist
            ValueError: If audio file is corrupted or unreadable
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Load with librosa (supports mp3, wav, flac, ogg, etc.)
        # Always resample to 24kHz as required by MuQ-MuLan
        audio, sr = librosa.load(audio_path, sr=DEFAULT_SAMPLE_RATE, mono=True)

        # Truncate to max duration for efficiency
        max_samples = int(max_duration_sec * DEFAULT_SAMPLE_RATE)
        if len(audio) > max_samples:
            audio = audio[:max_samples]

        # Convert to torch tensor with shape (1, samples)
        audio_tensor = torch.from_numpy(audio).float().unsqueeze(0)

        return audio_tensor

    def get_audio_embedding(self, audio_data: torch.Tensor) -> torch.Tensor:
        """
        Compute MuQ-MuLan embedding for preprocessed audio data.

        Args:
            audio_data: Preprocessed audio tensor of shape (1, samples) or (N, samples)

        Returns:
            Embedding tensor. Shape depends on model architecture.
        """
        with torch.no_grad():
            embedding = self.model(wavs=audio_data)
        return embedding

    def get_text_embedding(self, texts: list[str]) -> torch.Tensor:
        """
        Compute MuQ-MuLan embeddings for text prompts.

        Args:
            texts: List of text prompts to embed

        Returns:
            Embeddings tensor where the shape depends on model architecture.
        """
        with torch.no_grad():
            embedding = self.model(texts=texts)
        return embedding

    def score_spectrum(
        self,
        audio_embedding: torch.Tensor,
        positive_prompt: str,
        negative_prompt: str,
    ) -> float:
        """
        Compute where an audio falls on a text-defined spectrum from 0 to 1.

        The score is computed using MuQ-MuLan's built-in calc_similarity():
            score = sim(audio, positive) / (sim(audio, positive) + sim(audio, negative))

        This gives:
            - Score ~1.0 when audio is very similar to positive prompt
            - Score ~0.5 when audio is equally similar to both prompts
            - Score ~0.0 when audio is very similar to negative prompt

        Args:
            audio_embedding: MuQ-MuLan embedding of the audio
            positive_prompt: Text describing the "high" end (score ~1.0)
            negative_prompt: Text describing the "low" end (score ~0.0)

        Returns:
            Score in range [0.0, 1.0], rounded to 4 decimal places
        """
        # Get text embeddings
        text_embeddings = self.get_text_embedding([positive_prompt, negative_prompt])

        # Compute similarities using MuQ-MuLan's built-in method
        # calc_similarity expects audio_embeddings and text_embeddings
        similarities = self.model.calc_similarity(audio_embedding, text_embeddings)

        # Extract positive and negative similarities
        pos_sim = similarities[0, 0].item()
        neg_sim = similarities[0, 1].item()

        # Normalize to 0-1 scale
        # Using absolute value for negative similarity to ensure proper scaling
        score = pos_sim / (pos_sim + abs(neg_sim) + 1e-8)

        # Clamp to [0, 1] and round
        score = max(0.0, min(1.0, score))
        return round(score, 4)

    def analyse(
        self,
        audio_path: str | Path,
        metrics: tuple[MetricDefinition, ...] | None = None,
        max_duration_sec: float = DEFAULT_MAX_DURATION_SEC,
    ) -> dict[str, float]:
        """
        Run all MuQ-MuLan metrics on the given audio file.

        This is the main entry point for MuQ-MuLan analysis. It:
        1. Loads and preprocesses the audio
        2. Computes the audio embedding ONCE
        3. Scores against all provided metrics via spectrum comparison

        Args:
            audio_path: Path to audio file
            metrics: Metrics to compute. Defaults to DEFAULT_METRICS.
            max_duration_sec: Maximum duration to analyze. Default 60s.

        Returns:
            Dict mapping metric names to scores (0.0-1.0 scale):
            {
                'production_quality': 0.7250,
                'danceability': 0.8500,
                'temperament': 0.6030
            }

        Example:
            >>> analyser = MuqMulanAnalyser()
            >>> scores = analyser.analyse("track.mp3")
            >>> print(scores)
            {'production_quality': 0.7250, 'danceability': 0.8500, 'temperament': 0.6030}
        """
        if metrics is None:
            metrics = self.metrics

        # Step 1: Load and preprocess audio
        audio_data = self.load_audio(audio_path, max_duration_sec)

        # Move audio to device
        audio_data = audio_data.to(self.device)

        # Step 2: Compute audio embedding (ONCE, reused for all metrics)
        audio_embedding = self.get_audio_embedding(audio_data)

        # Step 3: Score against all metrics
        scores = {}
        for metric in metrics:
            score = self.score_spectrum(
                audio_embedding=audio_embedding,
                positive_prompt=metric.positive_prompt,
                negative_prompt=metric.negative_prompt,
            )
            scores[metric.name] = score

        return scores

    def get_metric_info(self, metric_name: str) -> MetricDefinition | None:
        """
        Get the definition of a specific metric by name.

        Args:
            metric_name: Name of the metric (e.g., 'danceability')

        Returns:
            MetricDefinition if found, None otherwise
        """
        for metric in self.metrics:
            if metric.name == metric_name:
                return metric
        return None

    def list_metrics(self) -> list[str]:
        """Return list of all available metric names."""
        return [m.name for m in self.metrics]
