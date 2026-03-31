import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import auth_service, get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UsernameRequest,
    UsernameResponse,
    UserResponse,
)
from app.services.username_validator import validate_username

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=request.email,
        password_hash=auth_service.hash_password(request.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = auth_service.create_access_token(user_id=str(user.id), email=user.email)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if user is None or not auth_service.verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = auth_service.create_access_token(user_id=str(user.id), email=user.email)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: dict = Depends(get_current_user)):
    return None


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(id=current_user["id"], email=current_user["email"])


@router.put("/username", response_model=UsernameResponse)
async def set_username(
    request: UsernameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    error = validate_username(request.username)
    if error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)

    # Check uniqueness
    result = await db.execute(select(User).where(User.username == request.username))
    existing = result.scalar_one_or_none()
    if existing and str(existing.id) != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    result = await db.execute(select(User).where(User.id == uuid.UUID(current_user["id"])))
    user = result.scalar_one()
    user.username = request.username
    await db.commit()
    return UsernameResponse(username=user.username)
