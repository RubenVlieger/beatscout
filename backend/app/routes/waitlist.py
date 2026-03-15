from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from app.db.database import async_session
from app.models.user import Waitlist
from sqlalchemy import select

router = APIRouter()


class WaitlistSignup(BaseModel):
    email: EmailStr


@router.post("/waitlist")
async def join_waitlist(data: WaitlistSignup):
    """Join the waitlist with email."""
    async with async_session() as session:
        # Check if email already exists
        result = await session.execute(
            select(Waitlist).where(Waitlist.email == data.email)
        )
        existing = result.scalar_one_or_none()

        if existing:
            return {
                "message": "You're already on the list!",
                "status": "already_subscribed",
            }

        # Create new waitlist entry
        waitlist_entry = Waitlist(email=data.email)
        session.add(waitlist_entry)
        await session.commit()

        return {"message": "You've been added to the waitlist!", "status": "subscribed"}
