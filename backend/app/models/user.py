import enum
from sqlalchemy import Column, String, DateTime, BigInteger, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.database import Base


class AuthProvider(str, enum.Enum):
    EMAIL = "email"
    GOOGLE = "google"
    APPLE = "apple"
    SOUNDCLOUD = "soundcloud"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Primary authentication fields
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)

    # OAuth provider IDs (all optional - at least one required)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    apple_id = Column(String(255), unique=True, nullable=True, index=True)
    soundcloud_id = Column(BigInteger, unique=True, nullable=True, index=True)

    # Profile info
    username = Column(String(255), nullable=False)
    avatar_url = Column(Text)

    # OAuth tokens (optional, for SoundCloud API access)
    soundcloud_access_token = Column(Text)
    soundcloud_refresh_token = Column(Text)

    # Billing
    stripe_customer_id = Column(String(255), unique=True, nullable=True)

    # Track primary auth provider
    auth_provider = Column(
        Enum(AuthProvider), nullable=False, default=AuthProvider.EMAIL
    )

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), onupdate=func.now())


class Waitlist(Base):
    __tablename__ = "waitlist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
