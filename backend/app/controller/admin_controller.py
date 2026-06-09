import asyncio
import os
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from backend.app.db.database import model_stats_collection, processed_collection
from backend.app.dependencies.auth import get_current_user
from backend.app.services.ml.trainer import run_retraining

admin_router = APIRouter(prefix="/admin", tags=["Admin"])

RETRAIN_THRESHOLD = int(os.getenv("RETRAIN_THRESHOLD", 300))
MODEL_STATS_ID = "singleton"


async def _do_retrain():
    print("[admin] Retraining started", flush=True)
    await model_stats_collection.update_one(
        {"_id": MODEL_STATS_ID},
        {"$set": {"in_progress": True}},
        upsert=True,
    )
    try:
        print("[admin] Calling run_retraining…", flush=True)
        metrics = await asyncio.to_thread(run_retraining)
        print(f"[admin] Retraining finished, metrics: {metrics}", flush=True)

        # Reset all edited tweets — corrections are now the model's new baseline
        await processed_collection.update_many(
            {"edited": True},
            [
                {
                    "$set": {
                        "edited": False,
                        "original_is_dangerous": "$is_dangerous",
                        "original_category": "$category",
                    }
                }
            ],
        )

        await model_stats_collection.update_one(
            {"_id": MODEL_STATS_ID},
            {
                "$set": {
                    "edit_count": 0,
                    "last_trained_at": datetime.now(timezone.utc),
                    "in_progress": False,
                    "last_metrics": metrics,
                    "last_error": None,
                }
            },
            upsert=True,
        )
        print("[admin] DB updated, retraining complete", flush=True)
    except Exception as e:
        print(f"[admin] Retraining FAILED: {e}", flush=True)
        await model_stats_collection.update_one(
            {"_id": MODEL_STATS_ID},
            {"$set": {"in_progress": False, "last_error": str(e)}},
            upsert=True,
        )


@admin_router.get("/model-stats")
async def get_model_stats(current_user: dict = Depends(get_current_user)):
    doc = await model_stats_collection.find_one({"_id": MODEL_STATS_ID})
    if not doc:
        return {
            "edit_count": 0,
            "last_trained_at": None,
            "in_progress": False,
            "last_metrics": None,
            "retrain_threshold": RETRAIN_THRESHOLD,
        }
    doc.pop("_id", None)
    doc["retrain_threshold"] = RETRAIN_THRESHOLD
    return doc


@admin_router.post("/retrain")
async def retrain(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    if not current_user.get("isADMIN"):
        raise HTTPException(status_code=403, detail="Admin only")

    doc = await model_stats_collection.find_one({"_id": MODEL_STATS_ID})
    if doc and doc.get("in_progress"):
        raise HTTPException(status_code=409, detail="Training already in progress")

    background_tasks.add_task(_do_retrain)
    return {"message": "Retraining started"}
