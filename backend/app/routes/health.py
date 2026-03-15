from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "beatscout-api", "version": "0.1.0"}


@router.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes/Docker."""
    # TODO: Add DB connection check
    return {"status": "ready"}
