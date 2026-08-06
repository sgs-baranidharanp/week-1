from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.database import SessionLocal
from models.user import User
from schemas.user import UserCreate, UserLogin

from services.auth import (
    hash_password,
    verify_password,
    create_access_token
)


router = APIRouter()


# =========================================================
# DATABASE
# =========================================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# =========================================================
# REGISTER
# =========================================================

@router.post("/register")
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    existing_user = (
        db.query(User)
        .filter(
            User.email == user.email
        )
        .first()
    )


    if existing_user:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )


    hashed_password = hash_password(
        user.password
    )


    new_user = User(
        name=user.name,
        email=user.email,
        password_hash=hashed_password
    )


    db.add(new_user)

    db.commit()

    db.refresh(new_user)


    return {
        "message": "User created successfully",
        "user_id": new_user.id
    }


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
def login(
    user: UserLogin,
    db: Session = Depends(get_db)
):

    db_user = (
        db.query(User)
        .filter(
            User.email == user.email
        )
        .first()
    )


    # User doesn't exist
    if not db_user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


    # Check password
    password_match = verify_password(
        user.password,
        db_user.password_hash
    )


    if not password_match:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


    # Create JWT
    access_token = create_access_token(
        {
            "user_id": db_user.id
        }
    )


    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "name": db_user.name,
            "email": db_user.email
        }
    }