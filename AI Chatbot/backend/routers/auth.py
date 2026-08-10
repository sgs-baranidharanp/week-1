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


@router.post("/login")
def login(
    user: UserLogin,
    db: Session = Depends(get_db)
):

    # Check if user already exists
    db_user = (
        db.query(User)
        .filter(User.email == user.email)
        .first()
    )

    # -------------------------------------------------
    # USER DOESN'T EXIST
    # CREATE ACCOUNT AUTOMATICALLY
    # -------------------------------------------------

    if db_user is None:

        hashed_password = hash_password(
            user.password
        )

        new_user = User(
            name=user.email.split("@")[0],   # Default name
            email=user.email,
            password_hash=hashed_password
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        access_token = create_access_token(
            {
                "user_id": new_user.id
            }
        )

        return {

            "message": "New account created",

            "access_token": access_token,

            "token_type": "bearer",

            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email
            }

        }

    # -------------------------------------------------
    # USER EXISTS
    # VERIFY PASSWORD
    # -------------------------------------------------

    password_match = verify_password(
        user.password,
        db_user.password_hash
    )

    if not password_match:

        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )

    # -------------------------------------------------
    # LOGIN
    # -------------------------------------------------

    access_token = create_access_token(
        {
            "user_id": db_user.id
        }
    )

    return {

        "message": "Login successful",

        "access_token": access_token,

        "token_type": "bearer",

        "user": {

            "id": db_user.id,

            "name": db_user.name,

            "email": db_user.email

        }

    }