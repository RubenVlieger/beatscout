from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Response, Depends, Body
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
import httpx
import secrets
import base64
from jose import jwt as pyjwt
from app.config import settings
from app.security import (
    create_access_token,
    get_current_user_id,
    hash_password,
    verify_password,
)
from app.db.database import async_session
from app.models.user import User, AuthProvider
from sqlalchemy import select, or_
from app.services.billing import create_stripe_customer

router = APIRouter()


# ============ Request/Response Models ============


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    username: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AppleAuthRequest(BaseModel):
    id_token: str
    user_data: dict = (
        None  # Contains { name: { firstName, lastName } } on first sign in
    )


class SoundCloudLinkRequest(BaseModel):
    code: str  # OAuth code from SoundCloud


# ============ Helper Functions ============


def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password strength.
    Returns (is_valid, error_message).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    # Check for common weak passwords
    common_passwords = [
        "password",
        "123456",
        "12345678",
        "qwerty",
        "abc123",
        "password123",
        "admin",
        "letmein",
        "welcome",
        "monkey",
    ]

    if password.lower() in common_passwords:
        return (
            False,
            "This password is too common. Please choose a more unique password",
        )

    # Check for sequential characters
    if password.isdigit() and len(password) >= 4:
        # Check for sequential digits (1234, 9876, etc.)
        is_sequential = True
        diff = int(password[1]) - int(password[0])
        for i in range(1, len(password)):
            if int(password[i]) - int(password[i - 1]) != diff:
                is_sequential = False
                break
        if is_sequential:
            return False, "Password cannot be a simple sequence of numbers"

    # Check for repeated characters (aaaaaaa, 1111111)
    if len(set(password)) == 1:
        return False, "Password cannot consist of the same character repeated"

    # Check for at least one letter and one number
    has_letter = any(c.isalpha() for c in password)
    has_number = any(c.isdigit() for c in password)

    if not has_letter or not has_number:
        return False, "Password must contain both letters and numbers"

    return True, ""


def set_auth_cookie(response: Response, token: str):
    """Set authentication cookie."""
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def create_user_with_token(
    session,
    email: str = None,
    password: str = None,
    username: str = None,
    google_id: str = None,
    apple_id: str = None,
    avatar_url: str = None,
    provider: AuthProvider = AuthProvider.EMAIL,
) -> tuple:
    """Create user and return JWT token."""

    # Create Stripe customer for billing
    stripe_customer_id = None
    if email:
        try:
            stripe_customer_id = await create_stripe_customer(email, username or email)
        except Exception as e:
            # Log error but don't block registration
            print(f"Stripe customer creation failed: {e}")

    user = User(
        email=email,
        password_hash=hash_password(password) if password else None,
        google_id=google_id,
        apple_id=apple_id,
        username=username or (email.split("@")[0] if email else "User"),
        avatar_url=avatar_url,
        stripe_customer_id=stripe_customer_id,
        auth_provider=provider,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    jwt_token = create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "provider": provider.value,
        }
    )

    return user, jwt_token


# ============ Email/Password Auth ============


@router.post("/register")
async def register(data: RegisterRequest, response: Response):
    """Register new user with email and password."""
    # Validate password strength
    is_valid, error_msg = validate_password(data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    async with async_session() as session:
        # Check if email already exists
        result = await session.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

        user, token = await create_user_with_token(
            session,
            email=data.email,
            password=data.password,
            username=data.username,
            provider=AuthProvider.EMAIL,
        )

        set_auth_cookie(response, token)

        return {
            "token": token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "auth_provider": user.auth_provider.value,
            },
        }


@router.post("/login")
async def login(data: LoginRequest, response: Response):
    """Login with email and password."""
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Update last login
        user.last_login = datetime.utcnow()
        await session.commit()

        jwt_token = create_access_token(
            data={
                "sub": str(user.id),
                "username": user.username,
                "provider": user.auth_provider.value,
            }
        )

        set_auth_cookie(response, jwt_token)

        return {
            "token": jwt_token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "auth_provider": user.auth_provider.value,
            },
        }


# ============ Google OAuth ============


@router.get("/google")
async def google_login():
    """Redirect to Google OAuth authorization."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured.",
        )

    # Generate state parameter for CSRF protection
    state = secrets.token_urlsafe(32)

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid email profile"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(code: str, state: str = None, request: Request = None):
    """Handle OAuth callback from Google."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured.",
        )

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=400, detail="Failed to get access token from Google"
            )

        token_data = token_response.json()
        id_token = token_data.get("id_token")

        # Decode ID token to get user info
        try:
            # Note: In production, verify the token signature
            decoded = pyjwt.decode(id_token, options={"verify_signature": False})
            google_id = decoded.get("sub")
            email = decoded.get("email")
            name = decoded.get("name", email.split("@")[0] if email else "User")
            picture = decoded.get("picture")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid ID token: {e}")

        async with async_session() as session:
            # Check if user exists by google_id
            result = await session.execute(
                select(User).where(User.google_id == google_id)
            )
            user = result.scalar_one_or_none()

            if user:
                # Update existing user
                user.last_login = datetime.utcnow()
                await session.commit()
                await session.refresh(user)
            else:
                # Check if user exists by email (link accounts)
                if email:
                    result = await session.execute(
                        select(User).where(User.email == email)
                    )
                    existing = result.scalar_one_or_none()
                    if existing:
                        # Link Google to existing account
                        existing.google_id = google_id
                        existing.last_login = datetime.utcnow()
                        await session.commit()
                        await session.refresh(existing)
                        user = existing

                if not user:
                    # Create new user
                    user, _ = await create_user_with_token(
                        session,
                        email=email,
                        username=name,
                        google_id=google_id,
                        avatar_url=picture,
                        provider=AuthProvider.GOOGLE,
                    )

            jwt_token = create_access_token(
                data={
                    "sub": str(user.id),
                    "username": user.username,
                    "provider": AuthProvider.GOOGLE.value,
                }
            )

    # Redirect to frontend with token
    redirect_url = f"{settings.FRONTEND_URL}/auth/callback/google?token={jwt_token}"
    response = RedirectResponse(url=redirect_url)
    set_auth_cookie(response, jwt_token)
    return response


# ============ Apple Sign In ============


@router.post("/apple")
async def apple_auth(data: AppleAuthRequest, response: Response):
    """Handle Apple Sign In."""
    if not settings.APPLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Apple Sign In is not configured.",
        )

    try:
        # Decode Apple ID token (in production, verify with Apple's public key)
        decoded = pyjwt.decode(data.id_token, options={"verify_signature": False})
        apple_id = decoded.get("sub")
        email = decoded.get("email")

        # Get name from user_data (only provided on first sign in)
        name = "User"
        if data.user_data and "name" in data.user_data:
            first = data.user_data["name"].get("firstName", "")
            last = data.user_data["name"].get("lastName", "")
            name = f"{first} {last}".strip() or "User"

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {e}")

    async with async_session() as session:
        # Check if user exists by apple_id
        result = await session.execute(select(User).where(User.apple_id == apple_id))
        user = result.scalar_one_or_none()

        if user:
            user.last_login = datetime.utcnow()
            await session.commit()
            await session.refresh(user)
        else:
            # Check if user exists by email
            if email:
                result = await session.execute(select(User).where(User.email == email))
                existing = result.scalar_one_or_none()
                if existing:
                    existing.apple_id = apple_id
                    existing.last_login = datetime.utcnow()
                    await session.commit()
                    await session.refresh(existing)
                    user = existing

            if not user:
                user, _ = await create_user_with_token(
                    session,
                    email=email,
                    username=name,
                    apple_id=apple_id,
                    provider=AuthProvider.APPLE,
                )

        jwt_token = create_access_token(
            data={
                "sub": str(user.id),
                "username": user.username,
                "provider": AuthProvider.APPLE.value,
            }
        )

        set_auth_cookie(response, jwt_token)

        return {
            "token": jwt_token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "auth_provider": user.auth_provider.value,
            },
        }


# ============ SoundCloud OAuth ============


@router.get("/soundcloud/login")
async def soundcloud_login():
    """Redirect to SoundCloud OAuth authorization."""
    if not settings.SOUNDCLOUD_CLIENT_ID or not settings.SOUNDCLOUD_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="SoundCloud OAuth is not configured.",
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
async def soundcloud_callback(code: str, state: str = None, request: Request = None):
    """Handle OAuth callback from SoundCloud."""
    if not settings.SOUNDCLOUD_CLIENT_ID or not settings.SOUNDCLOUD_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="SoundCloud OAuth is not configured.",
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
        refresh_token = token_data.get("refresh_token")

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
                    soundcloud_access_token=access_token,
                    soundcloud_refresh_token=refresh_token,
                    auth_provider=AuthProvider.SOUNDCLOUD,
                )
                session.add(user)
            else:
                # Update existing user
                user.username = username
                user.avatar_url = avatar_url
                user.soundcloud_access_token = access_token
                user.soundcloud_refresh_token = refresh_token
                user.last_login = datetime.utcnow()

            await session.commit()
            await session.refresh(user)

            # Create JWT for our app
            jwt_token = create_access_token(
                data={
                    "sub": str(user.id),
                    "username": username,
                    "provider": AuthProvider.SOUNDCLOUD.value,
                }
            )

        # Redirect to frontend with token
        redirect_url = (
            f"{settings.FRONTEND_URL}/auth/callback/soundcloud?token={jwt_token}"
        )
        response = RedirectResponse(url=redirect_url)
        set_auth_cookie(response, jwt_token)
        return response


# ============ SoundCloud Linking ============


@router.post("/link/soundcloud")
async def link_soundcloud(
    data: SoundCloudLinkRequest, user_id: str = Depends(get_current_user_id)
):
    """Link SoundCloud account to existing user."""
    if not settings.SOUNDCLOUD_CLIENT_ID or not settings.SOUNDCLOUD_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="SoundCloud OAuth is not configured.",
        )

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://api.soundcloud.com/oauth2/token",
            data={
                "client_id": settings.SOUNDCLOUD_CLIENT_ID,
                "client_secret": settings.SOUNDCLOUD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": settings.SOUNDCLOUD_REDIRECT_URI,
                "code": data.code,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=400, detail="Failed to get access token from SoundCloud"
            )

        token_data = token_response.json()
        access_token = token_data["access_token"]

        # Get user info
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

        async with async_session() as session:
            # Check if this SoundCloud account is already linked to another user
            result = await session.execute(
                select(User).where(User.soundcloud_id == soundcloud_id)
            )
            existing = result.scalar_one_or_none()
            if existing and str(existing.id) != user_id:
                raise HTTPException(
                    status_code=400,
                    detail="This SoundCloud account is already linked to another user",
                )

            # Update current user
            result = await session.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()

            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            user.soundcloud_id = soundcloud_id
            user.soundcloud_access_token = access_token
            user.soundcloud_refresh_token = token_data.get("refresh_token")
            await session.commit()

            return {
                "message": "SoundCloud account linked successfully",
                "soundcloud_username": user_info["username"],
            }


@router.post("/unlink/soundcloud")
async def unlink_soundcloud(user_id: str = Depends(get_current_user_id)):
    """Unlink SoundCloud account from user."""
    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.soundcloud_id = None
        user.soundcloud_access_token = None
        user.soundcloud_refresh_token = None
        await session.commit()

        return {"message": "SoundCloud account unlinked successfully"}


# ============ Common Auth Routes ============


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
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "auth_provider": user.auth_provider.value,
            "soundcloud_connected": user.soundcloud_id is not None,
            "stripe_customer_id": user.stripe_customer_id,
            "created_at": user.created_at,
        }
