from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    ForeignKey,
    Enum,
    BigInteger,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.database import Base


class Track(Base):
    __tablename__ = "tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    soundcloud_id = Column(BigInteger, unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    artist = Column(String(255))
    bpm = Column(Float)
    musical_key = Column(String(10))
    danceability = Column(Float)  # 0-100
    temperament = Column(Float)  # 0-100
    production_quality = Column(Float)  # 0-100
    genre = Column(String(100))
    soundcloud_url = Column(String(500), nullable=False)
    duration_seconds = Column(Integer)
    analysis_status = Column(String(50), default="pending")
    analyzed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to crates
    crates = relationship("UserCrate", back_populates="track")


class UserCrate(Base):
    __tablename__ = "user_crates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    track_id = Column(
        UUID(as_uuid=True), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False
    )
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    track = relationship("Track", back_populates="crates")
