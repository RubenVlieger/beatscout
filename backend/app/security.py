from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=401, detail="Invalid authentication credentials"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Dependency to get current authenticated user from JWT."""
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return payload


async def get_current_user_id(user: dict = Depends(get_current_user)) -> str:
    """Get just the user ID from the token."""
    return user.get("sub")


def hash_password(password: str) -> str:
    """Hash a plain text password.

    Bcrypt has a 72-byte limit, so we truncate to be safe.
    """
    # Truncate to 72 bytes (bcrypt limit) to avoid passlib errors
    password_bytes = password.encode("utf-8")[:72]
    truncated = password_bytes.decode("utf-8", errors="ignore")
    return pwd_context.hash(truncated)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against a hash.

    Must truncate to match what hash_password does.
    """
    # Truncate to 72 bytes (bcrypt limit)
    password_bytes = plain_password.encode("utf-8")[:72]
    truncated = password_bytes.decode("utf-8", errors="ignore")
    return pwd_context.verify(truncated, hashed_password)
