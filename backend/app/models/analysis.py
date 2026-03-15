from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.database import Base


class AnalysisRequest(Base):
    __tablename__ = "analysis_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    query_track_name = Column(String(500), nullable=False)
    artist_name = Column(String(255))
    status = Column(
        String(50), default="pending"
    )  # pending, processing, completed, failed
    total_edits_found = Column(Integer, default=0)
    cached_results = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
