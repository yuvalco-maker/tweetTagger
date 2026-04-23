from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.controller.users_controller import auth_router, users_router
from backend.app.controller.ml_controller import ml_router
from backend.app.db.database import connect_to_mongo, close_mongo_connection

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await connect_to_mongo()
        print("MongoDB connected successfully.")
        yield
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        raise e
    finally:
        await close_mongo_connection()
        print("MongoDB connection closed.")


app = FastAPI(
    title="Tweet Tagger",
    description="A server that uses ML to tag tweets",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(ml_router)


@app.get("/health")
async def health():
    return {"status": "alive", "database": "connected"}
