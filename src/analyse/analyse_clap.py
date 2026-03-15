"""
CLAP-based audio scoring engine for BeatScout.

This module provides the core CLAP (Contrastive Language-Audio Pretraining)
analysis functionality, including audio embedding computation and spectrum-based
scoring using natural language text prompts.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import librosa
import numpy as np
import torch
from laion_clap import CLAP_Module

if TYPE_CHECKING:
    from numpy.typing import NDArray

# =============================================================================
# Constants
# =============================================================================

DEFAULT_MODEL_PATH = (
    Path(__file__).parent.parent.parent
    / "models"
    / "music_audioset_epoch_15_esc_90.14.pt"
)
DEFAULT_SAMPLE_RATE = 48000  # CLAP requires 48kHz
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
    Defines a spectrum-based CLAP metric.

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
# CLAP Analyser
# =============================================================================


class ClapAnalyser:
    """
    Singleton CLAP analysis engine for computing text-guided audio scores.

    This class manages the CLAP model lifecycle (loading once, reusing across calls),
    audio preprocessing, embedding computation, and spectrum-based scoring.

    Thread Safety:
        The underlying CLAP model is NOT thread-safe. If parallel processing is needed,
        use a lock or instantiate separate ClapAnalyser instances per worker.

    Memory Usage:
        The HTSAT-base model requires ~2GB GPU memory. On CPU, expect ~4GB RAM usage.

    Example:
        >>> analyser = ClapAnalyser()
        >>> scores = analyser.analyse("track.mp3")
        >>> print(scores)
        {'production_quality': 72.5, 'danceability': 85.0, 'temperament': 60.3}
    """

    _instance: ClapAnalyser | None = None
    _initialized: bool = False

    def __new__(
        cls, model_path: str | Path | None = None, device: str | None = None
    ) -> ClapAnalyser:
        """
        Singleton pattern: ensures the 2GB model is loaded only once.

        Args:
            model_path: Path to CLAP checkpoint. Defaults to models/music_audioset_epoch_15_esc_90.14.pt
            device: torch device ('cuda', 'mps', 'cpu'). Defaults to best available.

        Note:
            The singleton pattern means subsequent instantiations with different
            model_path or device will return the already-initialized instance.
            To reload with different settings, delete the instance first:
                del ClapAnalyser._instance
                ClapAnalyser._initialized = False
        """
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(
        self, model_path: str | Path | None = None, device: str | None = None
    ) -> None:
        """
        Initialize the CLAP model with HTSAT-base encoder.

        This method is safe to call multiple times due to the _initialized flag.
        """
        if ClapAnalyser._initialized:
            return

        # Resolve model path
        if model_path is None:
            model_path = DEFAULT_MODEL_PATH
        model_path = Path(model_path)

        if not model_path.exists():
            raise FileNotFoundError(
                f"CLAP model checkpoint not found at {model_path}. "
                "Download from: https://huggingface.co/lukewx/laion-clap-music"
            )

        # Resolve device
        self.device = device if device else get_best_device()

        # Initialize CLAP module
        # NOTE: music_audioset_epoch_15_esc_90.14.pt requires HTSAT-base architecture
        # and must be loaded with enable_fusion=False
        self.model = CLAP_Module(enable_fusion=False, amodel="HTSAT-base")
        self.model.load_ckpt(str(model_path))

        # Move model to device
        self.model.model.to(self.device)
        self.model.model.eval()

        # Store metrics
        self.metrics = DEFAULT_METRICS

        ClapAnalyser._initialized = True

    @staticmethod
    def _int16_to_float32(x: NDArray[np.float32]) -> NDArray[np.float32]:
        """Convert int16 audio to float32 in range [-1, 1]."""
        return (x / 32767.0).astype("float32")

    @staticmethod
    def _float32_to_int16(x: NDArray[np.float32]) -> NDArray[np.int16]:
        """Convert float32 audio in range [-1, 1] to int16."""
        x = np.clip(x, a_min=-1.0, a_max=1.0)
        return (x * 32767.0).astype("int16")

    def load_audio(
        self, audio_path: str | Path, max_duration_sec: float = DEFAULT_MAX_DURATION_SEC
    ) -> NDArray[np.float32]:
        """
        Load and preprocess audio for CLAP embedding.

        Processing steps:
        1. Load audio file using librosa
        2. Resample to 48kHz (CLAP requirement)
        3. Convert to mono if stereo (average channels)
        4. Truncate to max_duration_sec for efficiency
        5. Quantize float32 -> int16 -> float32 (reduces precision noise)

        Args:
            audio_path: Path to audio file (mp3, wav, flac, etc. supported by librosa)
            max_duration_sec: Maximum duration to process. Default 60s for efficiency.

        Returns:
            Preprocessed audio as numpy array of shape (1, samples) for CLAP input.

        Raises:
            FileNotFoundError: If audio file doesn't exist
            ValueError: If audio file is corrupted or unreadable
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Load with librosa (supports mp3, wav, flac, ogg, etc.)
        # Always resample to 48kHz as required by CLAP
        audio, sr = librosa.load(audio_path, sr=DEFAULT_SAMPLE_RATE, mono=True)

        # Truncate to max duration for efficiency
        max_samples = int(max_duration_sec * DEFAULT_SAMPLE_RATE)
        if len(audio) > max_samples:
            audio = audio[:max_samples]

        # Reshape to (1, samples) as expected by CLAP
        audio = audio.reshape(1, -1)

        # Quantization step: reduces precision noise and matches CLAP training
        # Convert to int16 range and back to float32
        audio = self._int16_to_float32(self._float32_to_int16(audio))

        return audio

    def get_audio_embedding(
        self, audio_data: NDArray[np.float32], use_tensor: bool = False
    ) -> NDArray[np.float32] | torch.Tensor:
        """
        Compute CLAP embedding for preprocessed audio data.

        Args:
            audio_data: Preprocessed audio array of shape (1, samples) or (N, samples)
            use_tensor: If True, return torch.Tensor. If False, return numpy array.

        Returns:
            Embedding of shape (512,) for single audio or (N, 512) for batch.
            Values are L2-normalized unit vectors in CLAP's latent space.
        """
        # CLAP expects numpy array, quantized
        embedding = self.model.get_audio_embedding_from_data(
            x=audio_data, use_tensor=use_tensor
        )
        return embedding

    def get_text_embedding(
        self, texts: list[str], use_tensor: bool = False
    ) -> NDArray[np.float32] | torch.Tensor:
        """
        Compute CLAP embeddings for text prompts.

        Args:
            texts: List of text prompts to embed
            use_tensor: If True, return torch.Tensor. If False, return numpy array.

        Returns:
            Embeddings of shape (N, 512) where N is len(texts).
        """
        embedding = self.model.get_text_embedding(texts, use_tensor=use_tensor)
        return embedding

    def _cosine_similarity(
        self, a: NDArray[np.float32], b: NDArray[np.float32]
    ) -> float:
        """
        Compute cosine similarity between two vectors.

        Cosine similarity = dot(a, b) / (||a|| * ||b||)
        Since CLAP embeddings are L2-normalized, this reduces to dot product.

        Args:
            a: First vector (512,)
            b: Second vector (512,)

        Returns:
            Cosine similarity in range [-1, 1]
        """
        # Embeddings are already normalized, so dot product = cosine similarity
        return float(np.dot(a, b))

    def score_spectrum(
        self,
        audio_embedding: NDArray[np.float32],
        positive_prompt: str,
        negative_prompt: str,
    ) -> float:
        """
        Compute where an audio falls on a text-defined spectrum from 0 to 1.

        The score is computed as:
            score = sim(audio, positive) / (sim(audio, positive) + |sim(audio, negative)|)

        This gives:
            - Score ~1.0 when audio is very similar to positive prompt
            - Score ~0.5 when audio is equally similar to both prompts
            - Score ~0.0 when audio is very similar to negative prompt

        Args:
            audio_embedding: CLAP embedding of the audio (512,)
            positive_prompt: Text describing the "high" end (score ~1.0)
            negative_prompt: Text describing the "low" end (score ~0.0)

        Returns:
            Score in range [0.0, 1.0], rounded to 4 decimal places
        """
        # Get text embeddings
        text_embeddings = self.get_text_embedding([positive_prompt, negative_prompt])
        pos_embedding = text_embeddings[0]  # (512,)
        neg_embedding = text_embeddings[1]  # (512,)

        # Compute cosine similarities
        pos_sim = self._cosine_similarity(audio_embedding, pos_embedding)
        neg_sim = self._cosine_similarity(audio_embedding, neg_embedding)

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
        Run all CLAP metrics on the given audio file.

        This is the main entry point for CLAP analysis. It:
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
            >>> analyser = ClapAnalyser()
            >>> scores = analyser.analyse("track.mp3")
            >>> print(scores)
            {'production_quality': 0.7250, 'danceability': 0.8500, 'temperament': 0.6030}
        """
        if metrics is None:
            metrics = self.metrics

        # Step 1: Load and preprocess audio
        audio_data = self.load_audio(audio_path, max_duration_sec)

        # Step 2: Compute audio embedding (ONCE, reused for all metrics)
        audio_embedding = self.get_audio_embedding(audio_data, use_tensor=False)
        audio_embedding = audio_embedding.squeeze()  # (512,)

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
