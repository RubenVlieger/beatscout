"""
Explorer routes for BeatScout - serves example analysis data for demo purposes.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import random
from pathlib import Path

router = APIRouter()

# Genres for random assignment
GENRES = ["House", "Techno", "Tech House"]

# Camelot keys for random assignment
CAMELOT_KEYS = [
    "1A",
    "2A",
    "3A",
    "4A",
    "5A",
    "6A",
    "7A",
    "8A",
    "9A",
    "10A",
    "11A",
    "12A",
    "1B",
    "2B",
    "3B",
    "4B",
    "5B",
    "6B",
    "7B",
    "8B",
    "9B",
    "10B",
    "11B",
    "12B",
]


class SongData(BaseModel):
    id: str
    title: str
    artist: str
    filename: str
    tempo: int
    danceability: int
    temperament: int
    production_quality: int
    genre: str
    key: str
    url: str


class ExplorerData(BaseModel):
    metadata: dict
    songs: List[SongData]


@router.get("/example", response_model=ExplorerData)
async def get_example_data():
    """
    Get example analysis data for the explorer page.
    Public endpoint for demo purposes.
    """
    # Try multiple possible paths to find example_data.json
    # Docker container path: /app/example_data.json
    # Local development paths
    possible_paths = [
        # Docker container path
        Path("/app/example_data.json"),
        # From backend directory (where we copied it)
        Path(__file__).parent.parent.parent / "example_data.json",
        # Relative to this file: backend/app/routes/ -> ../../.. -> beatscout/
        Path(__file__).parent.parent.parent.parent / "example_data.json",
        # From current working directory
        Path("example_data.json"),
        # From project root (absolute)
        Path("/Users/rubenvlieger/Documents/beatscout/example_data.json"),
    ]

    example_data_path = None
    for path in possible_paths:
        if path.exists():
            example_data_path = path
            break

    if not example_data_path:
        raise HTTPException(
            status_code=404,
            detail=f"Example data not found. Tried: {[str(p) for p in possible_paths]}",
        )

    with open(example_data_path, "r") as f:
        data = json.load(f)

    # Transform songs data with random tempo and genres
    transformed_songs = []
    for idx, song in enumerate(data.get("songs", [])):
        # Parse filename to extract title
        filename = song.get("filename", "")
        title = filename.replace(".mp3", "").replace(".wav", "").strip()

        # Use tempo from JSON data (already generated deterministically)
        tempo = song.get("tempo", 130)

        # Random genre and key
        genre = random.choice(GENRES)
        key = random.choice(CAMELOT_KEYS)

        # Use normalized scores (0-100 scale)
        normalized_scores = song.get("normalized_scores", {})

        transformed_songs.append(
            SongData(
                id=str(idx),
                title=title,
                artist="Unknown Artist",  # Could parse from filename in the future
                filename=filename,
                tempo=tempo,
                danceability=normalized_scores.get("danceability", 50),
                temperament=normalized_scores.get("temperament", 50),
                production_quality=normalized_scores.get("production_quality", 50),
                genre=genre,
                key=key,
                url=song.get("url", ""),
            )
        )

    return ExplorerData(metadata=data.get("metadata", {}), songs=transformed_songs)
