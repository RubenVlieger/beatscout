from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.security import get_current_user_id
from app.services.analysis import AnalysisService

router = APIRouter()
analysis_service = AnalysisService()


class AnalysisRequest(BaseModel):
    track_name: str
    artist_name: Optional[str] = None


class AnalysisResponse(BaseModel):
    id: str
    track_name: str
    status: str
    total_edits_found: int = 0
    cached_results: int = 0
    message: str


@router.post("/request", response_model=AnalysisResponse)
async def request_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Request analysis for a track."""
    # Create analysis request record
    analysis_req = await analysis_service.create_request(
        db=db,
        user_id=user_id,
        query_track_name=request.track_name,
        artist_name=request.artist_name,
    )

    # Start analysis in background
    background_tasks.add_task(
        analysis_service.analyze_track,
        analysis_id=analysis_req.id,
        track_name=request.track_name,
        artist_name=request.artist_name,
        user_id=user_id,
    )

    return AnalysisResponse(
        id=str(analysis_req.id),
        track_name=request.track_name,
        status="pending",
        message="Analysis started. You can check status in the explorer.",
    )


@router.get("/status/{analysis_id}")
async def get_analysis_status(
    analysis_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get status of an analysis request."""
    status = await analysis_service.get_status(db, analysis_id, user_id)
    return status


@router.get("/results/{analysis_id}")
async def get_analysis_results(
    analysis_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get results of a completed analysis."""
    results = await analysis_service.get_results(db, analysis_id, user_id)
    return results
