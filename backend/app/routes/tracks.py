from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.database import get_db
from app.security import get_current_user_id
from app.models.track import Track, UserCrate
from pydantic import BaseModel

router = APIRouter()


class TrackResponse(BaseModel):
    id: str
    title: str
    artist: str
    bpm: Optional[float]
    musical_key: Optional[str]
    danceability: Optional[float]
    temperament: Optional[float]
    production_quality: Optional[float]
    genre: Optional[str]
    soundcloud_url: str
    duration_seconds: Optional[int]

    class Config:
        from_attributes = True


@router.get("/search", response_model=List[TrackResponse])
async def search_tracks(
    query: str = Query(..., description="Search query for tracks"),
    min_bpm: Optional[float] = Query(None),
    max_bpm: Optional[float] = Query(None),
    min_danceability: Optional[float] = Query(None, ge=0, le=100),
    max_danceability: Optional[float] = Query(None, ge=0, le=100),
    min_temperament: Optional[float] = Query(None, ge=0, le=100),
    max_temperament: Optional[float] = Query(None, ge=0, le=100),
    min_quality: Optional[float] = Query(None, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search tracks with filters."""
    stmt = select(Track).where(Track.title.ilike(f"%{query}%"))

    # Apply filters
    if min_bpm:
        stmt = stmt.where(Track.bpm >= min_bpm)
    if max_bpm:
        stmt = stmt.where(Track.bpm <= max_bpm)
    if min_danceability:
        stmt = stmt.where(Track.danceability >= min_danceability)
    if max_danceability:
        stmt = stmt.where(Track.danceability <= max_danceability)
    if min_temperament:
        stmt = stmt.where(Track.temperament >= min_temperament)
    if max_temperament:
        stmt = stmt.where(Track.temperament <= max_temperament)
    if min_quality:
        stmt = stmt.where(Track.production_quality >= min_quality)

    # Limit results
    stmt = stmt.limit(100)

    result = await db.execute(stmt)
    tracks = result.scalars().all()

    return tracks


@router.get("/{track_id}", response_model=TrackResponse)
async def get_track(track_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific track by ID."""
    result = await db.execute(select(Track).where(Track.id == track_id))
    track = result.scalar_one_or_none()

    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    return track


@router.post("/{track_id}/add-to-crate")
async def add_to_crate(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Add a track to user's crate."""
    # Check if already in crate
    result = await db.execute(
        select(UserCrate).where(
            UserCrate.user_id == user_id, UserCrate.track_id == track_id
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        return {"message": "Track already in crate"}

    # Add to crate
    crate_entry = UserCrate(user_id=user_id, track_id=track_id)
    db.add(crate_entry)
    await db.commit()

    return {"message": "Track added to crate"}


@router.get("/crate/my", response_model=List[TrackResponse])
async def get_my_crate(
    user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    """Get user's crate."""
    stmt = (
        select(Track)
        .join(UserCrate)
        .where(UserCrate.user_id == user_id)
        .order_by(desc(UserCrate.added_at))
    )

    result = await db.execute(stmt)
    tracks = result.scalars().all()

    return tracks
