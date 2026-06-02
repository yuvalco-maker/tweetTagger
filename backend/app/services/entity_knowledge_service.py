import asyncio
import re
from typing import Optional

import httpx

from backend.app.db.database import processed_collection

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIPEDIA_REST = "https://en.wikipedia.org/api/rest_v1"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# Wikipedia policy requires a descriptive User-Agent
_HEADERS = {
    "User-Agent": (
        "TweetTagger/1.0 (infrastructure threat intelligence; "
        "https://github.com/tweettagger) python-httpx/0.28"
    )
}

# Wikidata property IDs → human-readable edge labels
WIKIDATA_PROPS = {
    "P17": "located in country",
    "P571": "founded",
    "P452": "industry",
    "P31": "instance of",
    "P131": "located in",
    "P749": "parent organization",
    "P159": "headquarters",
    "P112": "founded by",
    "P127": "owned by",
    "P19": "birthplace",
    "P27": "citizenship",
    "P569": "birth date",
}

# Map property IDs to semantic node types (used for coloring)
PROP_NODE_TYPE = {
    "P17": "country",
    "P131": "country",
    "P159": "location",
    "P19": "location",
    "P571": "date",
    "P569": "date",
    "P452": "industry",
    "P31": "category",
    "P749": "organization",
    "P112": "person",
    "P127": "organization",
    "P27": "country",
}

NODE_TYPE_COLORS = {
    "entity": "#1d9bf0",
    "country": "#10b981",
    "location": "#06b6d4",
    "industry": "#f59e0b",
    "date": "#8b5cf6",
    "category": "#6366f1",
    "organization": "#ef4444",
    "person": "#ec4899",
    "default": "#9ca3af",
}

# Properties that contain useful location/org terms for tweet searching
SEARCH_PROPS = {"P17", "P131", "P159", "P452"}


# ---------------------------------------------------------------------------
# Wikipedia helpers
# ---------------------------------------------------------------------------

async def _search_wikipedia(query: str) -> Optional[str]:
    """
    Returns the best-matching Wikipedia title for a query.
    Uses opensearch for candidate titles, then batch-checks pageprops to skip
    disambiguation pages.
    """
    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        # 1. Get up to 5 title candidates via opensearch (autocomplete-style)
        res = await client.get(WIKIPEDIA_API, params={
            "action": "opensearch",
            "search": query,
            "limit": 5,
            "format": "json",
        })
        if res.status_code != 200:
            return None
        data = res.json()
        candidates: list[str] = data[1] if data and len(data) > 1 else []
        if not candidates:
            return None
        if len(candidates) == 1:
            return candidates[0]

        # 2. Batch-check pageprops to detect disambiguation pages
        res2 = await client.get(WIKIPEDIA_API, params={
            "action": "query",
            "prop": "pageprops",
            "titles": "|".join(candidates),
            "format": "json",
        })
        if res2.status_code != 200:
            return candidates[0]

        pages = res2.json().get("query", {}).get("pages", {})
        # Build title → is_disambig map
        disambig: set[str] = set()
        for page in pages.values():
            if "disambiguation" in page.get("pageprops", {}):
                disambig.add(page.get("title", ""))

        # 3. Return first non-disambiguation candidate (preserve opensearch order)
        for title in candidates:
            if title not in disambig:
                return title

        return candidates[0]


async def _get_wikipedia_summary(title: str) -> dict:
    async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers=_HEADERS) as client:
        res = await client.get(f"{WIKIPEDIA_REST}/page/summary/{title}")
        if res.status_code == 200:
            return res.json()
    return {}


async def _get_wikidata_id(title: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        res = await client.get(WIKIPEDIA_API, params={
            "action": "query",
            "prop": "pageprops",
            "titles": title,
            "format": "json",
        })
        if res.status_code != 200:
            return None
        data = res.json()
        for page in data.get("query", {}).get("pages", {}).values():
            return page.get("pageprops", {}).get("wikibase_item")
    return None


# ---------------------------------------------------------------------------
# Wikidata helpers
# ---------------------------------------------------------------------------

async def _get_wikidata_entity(qid: str) -> dict:
    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        res = await client.get(WIKIDATA_API, params={
            "action": "wbgetentities",
            "ids": qid,
            "languages": "en",
            "format": "json",
        })
        if res.status_code != 200:
            return {}
        data = res.json()
        return data.get("entities", {}).get(qid, {})


async def _resolve_qids(qids: list[str]) -> dict[str, str]:
    if not qids:
        return {}
    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        res = await client.get(WIKIDATA_API, params={
            "action": "wbgetentities",
            "ids": "|".join(qids[:50]),
            "props": "labels",
            "languages": "en",
            "format": "json",
        })
        if res.status_code != 200:
            return {}
        data = res.json()
        return {
            qid: entity.get("labels", {}).get("en", {}).get("value", qid)
            for qid, entity in data.get("entities", {}).items()
            if entity.get("labels", {}).get("en", {}).get("value")
        }


def _extract_claims(entity: dict) -> dict:
    """Return {prop_id: {"label", "value"|"qid", "type"}} for known props."""
    claims = entity.get("claims", {})
    result = {}

    for prop_id, edge_label in WIKIDATA_PROPS.items():
        if prop_id not in claims:
            continue
        mainsnak = claims[prop_id][0].get("mainsnak", {})
        datavalue = mainsnak.get("datavalue", {})
        dtype = datavalue.get("type")
        val = datavalue.get("value")

        if dtype == "wikibase-entityid":
            result[prop_id] = {"label": edge_label, "qid": val.get("id"), "type": dtype}
        elif dtype == "string":
            result[prop_id] = {"label": edge_label, "value": val, "type": "string"}
        elif dtype == "time":
            m = re.search(r"\+?(\d{4})", val.get("time", ""))
            if m:
                result[prop_id] = {"label": edge_label, "value": m.group(1), "type": "year"}
        elif dtype == "monolingualtext":
            result[prop_id] = {"label": edge_label, "value": val.get("text", ""), "type": "string"}

    return result


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------

# Sections that may contain dated vulnerability events — ordered by priority
_TIMELINE_SECTION_KEYWORDS = (
    "history", "timeline", "background", "founding", "origin",
    "controvers", "incident", "accident", "disaster",
    "environmental", "legal", "lawsuit", "litigation",
    "criticism", "security", "attack",
)
# Maximum number of sections to fetch content from (avoid too many API calls)
_MAX_TIMELINE_SECTIONS = 4


def _clean_wikitext(raw: str) -> list[str]:
    """Strip wiki markup and return non-trivial lines that contain a year."""
    lines = []
    for line in raw.split("\n"):
        line = line.strip()
        if not line or line.startswith("=="):
            continue
        line = re.sub(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", r"\1", line)
        line = re.sub(r"\{\{[^}]+\}\}", "", line)
        line = re.sub(r"'{2,}", "", line)
        line = re.sub(r"<[^>]+>", "", line)
        line = re.sub(r"\[\d+\]", "", line)
        line = re.sub(r"https?://\S+", "", line)
        line = line.strip("*# ").strip()

        if len(line) < 25:
            continue
        # Skip lines that are clearly leaked template/financial data
        # (many consecutive ALL-CAPS words are a sign of a table or template)
        caps_words = re.findall(r"\b[A-Z]{3,}\b", line)
        if len(caps_words) >= 4:
            continue
        if re.search(r"\b(1[5-9]\d{2}|20[0-3]\d)\b", line):
            lines.append(line)
    return lines


async def _fetch_section_wikitext(client: httpx.AsyncClient, title: str, idx: str) -> str:
    res = await client.get(WIKIPEDIA_API, params={
        "action": "parse", "page": title, "section": idx,
        "prop": "wikitext", "format": "json",
    })
    if res.status_code != 200:
        return ""
    return res.json().get("parse", {}).get("wikitext", {}).get("*", "")


async def _get_timeline(title: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=_HEADERS) as client:
            # 1. Get section list
            res = await client.get(WIKIPEDIA_API, params={
                "action": "parse", "page": title,
                "prop": "sections", "format": "json",
            })
            if res.status_code != 200:
                return []
            sections = res.json().get("parse", {}).get("sections", [])

            # 2. Pick up to _MAX_TIMELINE_SECTIONS matching sections (in order of priority)
            selected: list[str] = []
            for kw in _TIMELINE_SECTION_KEYWORDS:
                for sec in sections:
                    line_lower = sec.get("line", "").lower()
                    idx = sec.get("index", "")
                    if kw in line_lower and idx not in selected:
                        selected.append(idx)
                if len(selected) >= _MAX_TIMELINE_SECTIONS:
                    break

            if not selected:
                return []

            # 3. Fetch all selected sections in parallel
            wikitexts = await asyncio.gather(
                *[_fetch_section_wikitext(client, title, idx) for idx in selected]
            )

        # 4. Parse events from all sections, deduplicate by year
        seen: dict[str, dict] = {}
        for wikitext in wikitexts:
            for line in _clean_wikitext(wikitext):
                m = re.search(r"\b(1[5-9]\d{2}|20[0-3]\d)\b", line)
                if m:
                    year = m.group(1)
                    # Keep first occurrence per year (earlier sections = higher priority)
                    seen.setdefault(year, {"year": year, "event": line[:280]})

        return sorted(seen.values(), key=lambda e: e["year"])[:20]

    except Exception:
        return []


# ---------------------------------------------------------------------------
# MongoDB lookup
# ---------------------------------------------------------------------------

async def _get_related_tweets(entity_name: str, location_labels: list[str]) -> list[dict]:
    terms = [entity_name] + [t for t in location_labels if len(t) > 2][:4]
    pattern = "|".join(re.escape(t) for t in terms)

    cursor = processed_collection.find(
        {"is_dangerous": True, "content": {"$regex": pattern, "$options": "i"}},
        {"_id": 1, "content": 1, "category": 1, "url": 1, "username": 1, "created_at": 1},
    ).sort("created_at", -1).limit(10)

    tweets = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if doc.get("created_at"):
            doc["created_at"] = str(doc["created_at"])
        tweets.append(doc)
    return tweets


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def _build_graph(entity_name: str, description: str, thumbnail: Optional[str],
                 claims: dict, qid_labels: dict) -> tuple[list, list]:
    nodes = [{
        "id": "entity",
        "label": entity_name,
        "node_type": "entity",
        "description": description[:200] if description else "",
        "thumbnail": thumbnail,
        "color": NODE_TYPE_COLORS["entity"],
    }]
    edges = []

    for prop_id, val in claims.items():
        edge_label = val["label"]
        node_type = PROP_NODE_TYPE.get(prop_id, "default")

        if val["type"] == "wikibase-entityid":
            qid = val.get("qid", "")
            display = qid_labels.get(qid, qid)
        else:
            display = val.get("value", "")

        if not display:
            continue

        node_id = f"{prop_id}_{re.sub(r'[^a-zA-Z0-9]', '_', display)[:24]}"

        nodes.append({
            "id": node_id,
            "label": display,
            "node_type": node_type,
            "description": edge_label,
            "thumbnail": None,
            "color": NODE_TYPE_COLORS.get(node_type, NODE_TYPE_COLORS["default"]),
        })
        edges.append({
            "id": f"e_{prop_id}",
            "source": "entity",
            "target": node_id,
            "label": edge_label,
        })

    return nodes, edges


# ---------------------------------------------------------------------------
# Suggested queries
# ---------------------------------------------------------------------------

def _suggested_queries(entity_name: str, claims: dict, qid_labels: dict) -> list[dict]:
    country = industry = location = ""

    for prop_id, val in claims.items():
        qid = val.get("qid", "")
        resolved = qid_labels.get(qid, val.get("value", ""))
        if prop_id == "P17":
            country = resolved
        elif prop_id == "P452":
            industry = resolved
        elif prop_id in ("P159", "P131"):
            location = location or resolved

    suggestions = [
        {
            "keywords": [entity_name, "attack", "threat"],
            "reason": f"Direct threats mentioning {entity_name}",
            "category": "Direct Threat",
        },
        {
            "keywords": [entity_name, "security", "vulnerability"],
            "reason": f"Security weaknesses exposed about {entity_name}",
            "category": "Security",
        },
        {
            "keywords": [entity_name, "fire", "explosion", "accident"],
            "reason": f"Operational incidents at {entity_name} facilities",
            "category": "Operational Risk",
        },
    ]

    if country:
        suggestions.append({
            "keywords": [country, "energy", "infrastructure"],
            "reason": f"National energy infrastructure threats in {country}",
            "category": "National Infrastructure",
        })

    if industry:
        suggestions.append({
            "keywords": [industry, "sabotage", "strike"],
            "reason": f"Industry-wide disruption patterns in {industry}",
            "category": "Industry Threat",
        })

    if location and location != country:
        suggestions.append({
            "keywords": [location, entity_name, "protest"],
            "reason": f"Social unrest near {entity_name} in {location}",
            "category": "Social Unrest",
        })

    return suggestions


# ---------------------------------------------------------------------------
# Vulnerability queries from Wikipedia timeline
# ---------------------------------------------------------------------------

# Keyword groups → vulnerability type
_VULN_GROUPS: list[tuple[str, list[str]]] = [
    ("Physical Attack",       ["attack", "bomb", "missile", "rocket", "shelling", "terror",
                               "sabotage", "arson", "armed", "assault", "raided", "targeted",
                               "strike", "warfare", "combatant"]),
    ("Conflict Zone",         ["war", "conflict", "battle", "invasion", "siege", "occupation",
                               "hostility", "ceasefire", "military"]),
    ("Operational Incident",  ["fire", "explosion", "blast", "accident", "incident", "collapsed",
                               "rupture", "failure", "malfunction", "shutdown", "outage", "halt"]),
    ("Environmental Incident",["spill", "leak", "contamination", "pollution", "discharge",
                               "hazardous", "toxic"]),
    ("Cyber / Intelligence",  ["hack", "cyber", "breach", "intrusion", "espionage", "intelligence",
                               "surveillance", "data"]),
    ("Social Unrest",         ["protest", "riot", "strike", "demonstration", "blockade",
                               "occupation", "unrest", "tension"]),
    ("Regulatory / Political",["sanction", "ban", "nationalize", "seizure", "fine", "lawsuit",
                               "investigation", "scandal"]),
]

# Words useful as search keywords but too generic on their own
_STOP_KEYWORDS = {"the", "a", "an", "was", "were", "is", "are", "it", "its", "in",
                  "on", "at", "to", "of", "for", "by", "with", "and", "or", "that",
                  "which", "when", "after", "during", "have", "had", "has"}

_TWITTER_LAUNCH_YEAR = 2006
_CURRENT_YEAR = 2026


def _kw_pattern(kw: str) -> re.Pattern:
    """Compile a word-boundary regex that also handles common plural/verb suffixes."""
    return re.compile(r"\b" + re.escape(kw) + r"(s|ed|ing|er|ers|ation|ations)?\b")


# Pre-compile all patterns once at import time
_VULN_PATTERNS: list[tuple[str, list[tuple[str, re.Pattern]]]] = [
    (vtype, [(kw, _kw_pattern(kw)) for kw in kws])
    for vtype, kws in _VULN_GROUPS
]


def _classify_event(text_lower: str) -> tuple[Optional[str], list[str]]:
    """Return (vulnerability_type, matched_keywords) or (None, []) if not a vuln event."""
    for vuln_type, kw_patterns in _VULN_PATTERNS:
        matched = [kw for kw, pat in kw_patterns if pat.search(text_lower)]
        if matched:
            return vuln_type, matched
    return None, []


def _date_range_for_year(event_year: int) -> tuple[str, str, str]:
    """
    Return (start_date, end_date, date_note) for a Twitter search.
    - Pre-Twitter events  → search recent years for anniversary discussions.
    - Post-launch events  → search the event year ±1 year.
    """
    if event_year < _TWITTER_LAUNCH_YEAR:
        # Search for anniversary discussions in the last 3 years
        start = f"{_CURRENT_YEAR - 3}-01-01"
        end   = f"{_CURRENT_YEAR}-12-31"
        note  = f"Anniversary discussions ({_CURRENT_YEAR-3}–{_CURRENT_YEAR}); original event pre-dates Twitter"
    elif event_year >= _CURRENT_YEAR - 1:
        # Very recent — tight window
        start = f"{event_year}-01-01"
        end   = f"{_CURRENT_YEAR}-12-31"
        note  = f"Recent event ({event_year}–present)"
    else:
        start = f"{event_year - 1}-01-01"
        end   = f"{event_year + 1}-12-31"
        note  = f"Period around the {event_year} incident"
    return start, end, note


def _extract_vulnerability_queries(timeline: list[dict], entity_name: str) -> list[dict]:
    """
    Analyse each Wikipedia timeline event for vulnerability signals.
    Returns suggested Twitter search queries with pre-filled date ranges.
    """
    results = []
    seen_types: set[str] = set()  # deduplicate by (year, type)

    for event in timeline:
        year_str = event.get("year", "")
        text = event.get("event", "")
        text_lower = text.lower()

        vuln_type, matched_kws = _classify_event(text_lower)
        if not vuln_type:
            continue

        dedup_key = f"{year_str}_{vuln_type}"
        if dedup_key in seen_types:
            continue
        seen_types.add(dedup_key)

        try:
            event_year = int(year_str)
        except ValueError:
            continue

        start, end, date_note = _date_range_for_year(event_year)

        # Build meaningful search keywords:
        # entity name + top 2 matched vulnerability keywords
        search_keywords = [entity_name] + matched_kws[:2]

        results.append({
            "year": year_str,
            "event_summary": text[:240],
            "vulnerability_type": vuln_type,
            "keywords": search_keywords,
            "start_date": start,
            "end_date": end,
            "date_note": date_note,
        })

    # Sort chronologically
    results.sort(key=lambda r: r["year"])
    return results


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def get_entity_knowledge_graph(query: str) -> Optional[dict]:
    # 1. Find Wikipedia title
    title = await _search_wikipedia(query)
    if not title:
        return None

    # 2. Fetch summary + Wikidata ID in parallel
    summary, wikidata_id = await asyncio.gather(
        _get_wikipedia_summary(title),
        _get_wikidata_id(title),
    )

    description = summary.get("extract", "")
    thumbnail = (summary.get("thumbnail") or {}).get("source")
    wikipedia_url = (
        summary.get("content_urls", {}).get("desktop", {}).get("page", "")
    )

    claims: dict = {}
    qid_labels: dict = {}
    timeline: list = []

    if wikidata_id:
        entity_data, timeline = await asyncio.gather(
            _get_wikidata_entity(wikidata_id),
            _get_timeline(title),
        )
        claims = _extract_claims(entity_data)

        # Batch-resolve all Q-IDs referenced in claims
        qids = [v["qid"] for v in claims.values() if v.get("type") == "wikibase-entityid" and v.get("qid")]
        qid_labels = await _resolve_qids(qids)

    # 3. Build graph
    nodes, edges = _build_graph(title, description, thumbnail, claims, qid_labels)

    # 4. Fetch related dangerous tweets using location labels
    location_labels = [
        qid_labels.get(v["qid"], v.get("value", ""))
        for prop_id, v in claims.items()
        if prop_id in SEARCH_PROPS
    ]
    related_tweets = await _get_related_tweets(title, location_labels)

    # 5. Suggested search queries (general, from graph attributes)
    suggested = _suggested_queries(title, claims, qid_labels)

    # 6. Vulnerability queries (date-anchored, from Wikipedia timeline events)
    vulnerability_queries = _extract_vulnerability_queries(timeline, title)

    return {
        "entity": title,
        "query": query,
        "wikidata_id": wikidata_id,
        "wikipedia_url": wikipedia_url,
        "description": description,
        "thumbnail": thumbnail,
        "nodes": nodes,
        "edges": edges,
        "timeline": timeline,
        "related_dangerous_tweets": related_tweets,
        "suggested_queries": suggested,
        "vulnerability_queries": vulnerability_queries,
    }
