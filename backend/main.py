from fastapi import FastAPI

from database.database import engine, Base
from models.user import User
from models.chat import ChatMessage
from routers.chat import router as chat_router
from routers.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware

Base.metadata.create_all(bind=engine)


app = FastAPI()

app.include_router(auth_router)
app.include_router(chat_router)
@app.get("/")
def home():
    return {
        "message": "FastAPI + PostgreSQL working"
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
