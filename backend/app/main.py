from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

from app.config import settings
from app.db.database import engine, Base
from app.routes import auth, tracks, analysis, health, waitlist, explorer


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: Cleanup
    await engine.dispose()


# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="BeatScout API",
    description="AI-Powered Edit Discovery for DJs",
    version="0.1.0",
    lifespan=lifespan,
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(tracks.router, prefix="/api/tracks", tags=["tracks"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(waitlist.router, prefix="/api/waitlist", tags=["waitlist"])
app.include_router(explorer.router, prefix="/api/explorer", tags=["explorer"])


@app.get("/")
async def root():
    return {"message": "BeatScout API", "version": "0.1.0"}
