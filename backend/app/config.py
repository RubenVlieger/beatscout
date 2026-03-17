from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "BeatScout"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:3000"

    # Security
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://beatcout.io"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@db:5432/beatcout"

    # OAuth - Google
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    # OAuth - Apple
    APPLE_CLIENT_ID: str = ""
    APPLE_TEAM_ID: str = ""
    APPLE_KEY_ID: str = ""
    APPLE_PRIVATE_KEY: str = ""
    APPLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/apple/callback"

    # OAuth - SoundCloud
    SOUNDCLOUD_CLIENT_ID: str = ""
    SOUNDCLOUD_CLIENT_SECRET: str = ""
    SOUNDCLOUD_REDIRECT_URI: str = "http://localhost:8000/api/auth/soundcloud/callback"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # Analysis
    CLAP_MODEL_PATH: str = "/app/models/music_audioset_epoch_15_esc_90.14.pt"
    MAX_AUDIO_DURATION: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
