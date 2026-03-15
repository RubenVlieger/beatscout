from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import RedirectResponse
import httpx
from app.config import settings
from app.security import create_access_token, get_current_user_id
from app.db.database import async_session
from app.models.user import User
from sqlalchemy import select

router = APIRouter()


@router.get("/soundcloud/login")
async def soundcloud_login():
    """Redirect to SoundCloud OAuth authorization."""
    # Check if SoundCloud credentials are configured
    if not settings.SOUNDCLOUD_CLIENT_ID or not settings.SOUNDCLOUD_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="SoundCloud OAuth is not configured. Please set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET environment variables.",
        )

    auth_url = (
        f"https://secure.soundcloud.com/connect"
        f"?client_id={settings.SOUNDCLOUD_CLIENT_ID}"
        f"&redirect_uri={settings.SOUNDCLOUD_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=non-expiring"
    )
    return RedirectResponse(url=auth_url)


@router.get("/soundcloud/callback")
async def soundcloud_callback(code: str, request: Request):
    """Handle OAuth callback from SoundCloud."""
    # Check if SoundCloud credentials are configured
    if not settings.SOUNDCLOUD_CLIENT_ID or not settings.SOUNDCLOUD_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="SoundCloud OAuth is not configured. Please set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET environment variables.",
        )

    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        token_response = await client.post(
            "https://api.soundcloud.com/oauth2/token",
            data={
                "client_id": settings.SOUNDCLOUD_CLIENT_ID,
                "client_secret": settings.SOUNDCLOUD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": settings.SOUNDCLOUD_REDIRECT_URI,
                "code": code,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=400, detail="Failed to get access token from SoundCloud"
            )

        token_data = token_response.json()
        access_token = token_data["access_token"]

        # Get user info from SoundCloud
        user_response = await client.get(
            "https://api.soundcloud.com/me",
            headers={"Authorization": f"OAuth {access_token}"},
        )

        if user_response.status_code != 200:
            raise HTTPException(
                status_code=400, detail="Failed to get user info from SoundCloud"
            )

        user_info = user_response.json()
        soundcloud_id = user_info["id"]
        username = user_info["username"]
        avatar_url = user_info.get("avatar_url", "")

        # Create or update user in database
        async with async_session() as session:
            # Check if user exists
            result = await session.execute(
                select(User).where(User.soundcloud_id == soundcloud_id)
            )
            user = result.scalar_one_or_none()

            if user is None:
                # Create new user
                user = User(
                    soundcloud_id=soundcloud_id,
                    username=username,
                    avatar_url=avatar_url,
                    access_token=access_token,
                )
                session.add(user)
            else:
                # Update existing user
                user.username = username
                user.avatar_url = avatar_url
                user.access_token = access_token
                user.last_login = datetime.utcnow()

            await session.commit()
            await session.refresh(user)

            # Create JWT for our app
            jwt_token = create_access_token(
                data={"sub": str(user.id), "username": username}
            )

        # Redirect to frontend with token
        frontend_url = "http://localhost:3000/explorer"
        response = RedirectResponse(url=f"{frontend_url}?token={jwt_token}")

        # Set HTTP-only cookie
        response.set_cookie(
            key="auth_token",
            value=jwt_token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

        return response


@router.post("/logout")
async def logout(response: Response):
    """Logout user by clearing cookie."""
    response.delete_cookie("auth_token")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)):
    """Get current user info."""
    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "id": str(user.id),
            "username": user.username,
            "avatar_url": user.avatar_url,
            "created_at": user.created_at,
        }
