from sqlalchemy import Column, String, DateTime, BigInteger, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    soundcloud_id = Column(BigInteger, unique=True, nullable=False, index=True)
    username = Column(String(255), nullable=False)
    avatar_url = Column(Text)
    access_token = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), onupdate=func.now())


class Waitlist(Base):
    __tablename__ = "waitlist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
