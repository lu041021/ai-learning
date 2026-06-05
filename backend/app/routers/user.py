from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/api")


@router.post("/users", response_model=UserOut)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.local_id == data.local_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(username=data.username, local_id=data.local_id)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/users/by-local/{local_id}", response_model=UserOut)
async def get_user_by_local(local_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.local_id == local_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
