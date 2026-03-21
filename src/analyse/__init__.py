"""
BeatScout Audio Analysis Module

Provides audio scoring for danceability, temperament,
and production quality metrics.
"""

from .analyse import AnalysisEngine, AnalysisResult, analyse_track, get_engine

__all__ = ["AnalysisEngine", "AnalysisResult", "analyse_track", "get_engine"]
