from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.dependencies.auth import get_current_user
from backend.app.services.entity_knowledge_service import get_entity_knowledge_graph

entity_router = APIRouter(prefix="/entity", tags=["Entity"])


@entity_router.get("/graph")
async def get_entity_graph(
    q: str = Query(..., min_length=1, max_length=200, description="Entity name to look up"),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns a knowledge graph for the given entity by querying Wikipedia and Wikidata.
    Also surfaces related dangerous tweets from the database and suggests threat-focused
    Twitter search queries.
    """
    try:
        result = await get_entity_knowledge_graph(q)
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"Entity '{q}' not found on Wikipedia.",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
