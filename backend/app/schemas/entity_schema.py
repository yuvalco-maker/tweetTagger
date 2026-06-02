from pydantic import BaseModel
from typing import Optional, List, Any, Dict


class GraphNode(BaseModel):
    id: str
    label: str
    node_type: str
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    color: Optional[str] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None


class TimelineEvent(BaseModel):
    year: str
    event: str


class SuggestedQuery(BaseModel):
    keywords: List[str]
    reason: str
    category: str


class VulnerabilityQuery(BaseModel):
    year: str
    event_summary: str
    vulnerability_type: str
    keywords: List[str]
    start_date: str
    end_date: str
    date_note: str


class EntityKnowledgeGraph(BaseModel):
    entity: str
    query: str
    wikidata_id: Optional[str] = None
    wikipedia_url: Optional[str] = None
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    timeline: List[TimelineEvent]
    related_dangerous_tweets: List[Dict[str, Any]]
    suggested_queries: List[SuggestedQuery]
    vulnerability_queries: List[VulnerabilityQuery] = []
