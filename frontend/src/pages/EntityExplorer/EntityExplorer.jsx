import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import styles from "./EntityExplorer.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

// ── Custom node: central entity ──────────────────────────────────────────────
function EntityNode({ data }) {
  return (
    <div className={styles.entityNode} style={{ borderColor: data.color }}>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      {data.thumbnail && (
        <img src={data.thumbnail} alt="" className={styles.entityThumb} />
      )}
      <span className={styles.entityNodeLabel}>{data.label}</span>
      {data.description && (
        <span className={styles.entityNodeDesc}>{data.description.slice(0, 80)}…</span>
      )}
    </div>
  );
}

// ── Custom node: attribute ────────────────────────────────────────────────────
function AttrNode({ data }) {
  return (
    <div className={styles.attrNode} style={{ borderColor: data.color }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span className={styles.attrNodeType} style={{ color: data.color }}>
        {data.description}
      </span>
      <span className={styles.attrNodeLabel}>{data.label}</span>
    </div>
  );
}

const nodeTypes = { entityNode: EntityNode, attrNode: AttrNode };

// ── Radial layout ─────────────────────────────────────────────────────────────
function buildFlowElements(rawNodes, rawEdges) {
  const centerX = 350;
  const centerY = 280;
  const radius = 240;

  const entity = rawNodes.find((n) => n.id === "entity");
  const attrs = rawNodes.filter((n) => n.id !== "entity");

  const flowNodes = [
    {
      id: entity.id,
      type: "entityNode",
      position: { x: centerX - 80, y: centerY - 45 },
      data: { ...entity },
    },
  ];

  attrs.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / attrs.length - Math.PI / 2;
    flowNodes.push({
      id: node.id,
      type: "attrNode",
      position: {
        x: centerX + radius * Math.cos(angle) - 60,
        y: centerY + radius * Math.sin(angle) - 28,
      },
      data: { ...node },
    });
  });

  const flowEdges = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: false,
    style: { stroke: "#4b5563", strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: "var(--text-muted)", fontFamily: "inherit" },
    labelBgStyle: { fill: "var(--card-surface)", fillOpacity: 0.85 },
  }));

  return { flowNodes, flowEdges };
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EntityExplorer() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const pendingScrollRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("entity_explorer_state");
    if (!saved) return;
    sessionStorage.removeItem("entity_explorer_state");
    try {
      const s = JSON.parse(saved);
      setQuery(s.query || "");
      if (s.data) {
        setData(s.data);
        const { flowNodes, flowEdges } = buildFlowElements(s.data.nodes, s.data.edges);
        setNodes(flowNodes);
        setEdges(flowEdges);
        if (s.scrollY) pendingScrollRef.current = s.scrollY;
      }
    } catch {}
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (data && pendingScrollRef.current !== null) {
      const scrollY = pendingScrollRef.current;
      pendingScrollRef.current = null;
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollY)));
    }
  }, [data]);

  const launchSearch = useCallback((url) => {
    sessionStorage.setItem("entity_explorer_state", JSON.stringify({
      query,
      data,
      scrollY: window.scrollY,
    }));
    navigate(url);
  }, [query, data, navigate]);

  const handleSearch = useCallback(
    async (e) => {
      e.preventDefault();
      if (!query.trim()) return;

      const token = localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }

      setLoading(true);
      setError("");
      setData(null);
      setNodes([]);
      setEdges([]);

      try {
        const res = await fetch(
          `${SERVER_URL}/entity/graph?q=${encodeURIComponent(query.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.detail || "Entity not found.");
          return;
        }
        setData(json);
        const { flowNodes, flowEdges } = buildFlowElements(json.nodes, json.edges);
        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch {
        setError("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    },
    [query, navigate, setNodes, setEdges],
  );

  const vulnTypeColor = (type) => ({
    "Physical Attack":        "#ef4444",
    "Conflict Zone":          "#f97316",
    "Operational Incident":   "#f59e0b",
    "Environmental Incident": "#10b981",
    "Cyber / Intelligence":   "#6366f1",
    "Social Unrest":          "#ec4899",
    "Regulatory / Political": "#8b5cf6",
  }[type] || "#9ca3af");

  const categoryColors = {
    "Direct Threat": "#ef4444",
    Security: "#f59e0b",
    "Operational Risk": "#8b5cf6",
    "National Infrastructure": "#10b981",
    "Industry Threat": "#06b6d4",
    "Social Unrest": "#ec4899",
  };

  const timelineByDecade = useMemo(() => {
    if (!data?.timeline?.length) return [];
    return data.timeline;
  }, [data]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back home
        </button>

        <h1 className={styles.title}>Entity Explorer</h1>
        <p className={styles.subtitle}>
          Search any company, person, or organisation to visualise its knowledge graph,
          discover related threats in the tweet database, and generate targeted search queries.
        </p>

        {/* ── Search ── */}
        <form className={styles.searchRow} onSubmit={handleSearch}>
          <input
            className={styles.searchInput}
            placeholder="e.g. Bazan, Chevron, OPEC…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button className={styles.searchButton} type="submit" disabled={loading || !query.trim()}>
            {loading ? "Loading…" : "Search"}
          </button>
        </form>

        {error && <p className={styles.errorMsg}>{error}</p>}

        {data && (
          <>
            {/* ── Entity header ── */}
            <section className={styles.entityHeader}>
              {data.thumbnail && (
                <img src={data.thumbnail} alt={data.entity} className={styles.headerThumb} />
              )}
              <div className={styles.entityMeta}>
                <h2 className={styles.entityTitle}>{data.entity}</h2>
                {data.wikidata_id && (
                  <span className={styles.wikidataBadge}>{data.wikidata_id}</span>
                )}
                <p className={styles.entityDescription}>{data.description}</p>
                {data.wikipedia_url && (
                  <a href={data.wikipedia_url} target="_blank" rel="noreferrer" className={styles.wikiLink}>
                    Open Wikipedia →
                  </a>
                )}
              </div>
            </section>

            {/* ── Knowledge graph ── */}
            <section className={styles.graphSection}>
              <h2 className={styles.sectionTitle}>Knowledge Graph</h2>
              <div className={styles.graphBox}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.25 }}
                  minZoom={0.3}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="var(--border-soft)" gap={24} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
            </section>

            {/* ── Timeline ── */}
            {timelineByDecade.length > 0 && (
              <section className={styles.timelineSection}>
                <h2 className={styles.sectionTitle}>Historical Timeline</h2>
                <div className={styles.timeline}>
                  {timelineByDecade.map((ev, i) => (
                    <div key={i} className={styles.timelineItem}>
                      <div className={styles.timelineYear}>{ev.year}</div>
                      <div className={styles.timelineDot} />
                      <div className={styles.timelineEvent}>{ev.event}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Vulnerability queries from timeline ── */}
            {data.vulnerability_queries?.length > 0 && (
              <section className={styles.vulnSection}>
                <h2 className={styles.sectionTitle}>
                  Historical Vulnerability Queries
                  <span className={styles.vulnBadge}>{data.vulnerability_queries.length}</span>
                </h2>
                <p className={styles.queriesSubtitle}>
                  Each query is anchored to a real incident from Wikipedia — keywords and date
                  range are pre-filled so you can search for Twitter discussions around that event.
                </p>
                <div className={styles.vulnGrid}>
                  {data.vulnerability_queries.map((vq, i) => (
                    <div key={i} className={styles.vulnCard}>
                      <div className={styles.vulnHeader}>
                        <span className={styles.vulnYear}>{vq.year}</span>
                        <span
                          className={styles.vulnType}
                          style={{ color: vulnTypeColor(vq.vulnerability_type) }}
                        >
                          {vq.vulnerability_type}
                        </span>
                      </div>
                      <p className={styles.vulnEvent}>{vq.event_summary}</p>
                      <div className={styles.vulnKeywords}>
                        {vq.keywords.map((kw) => (
                          <span key={kw} className={styles.keyword}>{kw}</span>
                        ))}
                      </div>
                      <div className={styles.vulnDates}>
                        <span className={styles.vulnDateLabel}>Search window:</span>
                        <span className={styles.vulnDateRange}>
                          {vq.start_date} → {vq.end_date}
                        </span>
                      </div>
                      <p className={styles.vulnDateNote}>{vq.date_note}</p>
                      <button
                        className={styles.queryLaunch}
                        onClick={() =>
                          launchSearch(
                            `/search-query?keywords=${encodeURIComponent(vq.keywords.join(" "))}&start_date=${vq.start_date}&end_date=${vq.end_date}&from=entity-explorer`,
                          )
                        }
                      >
                        Launch with dates →
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Suggested threat queries ── */}
            {data.suggested_queries?.length > 0 && (
              <section className={styles.queriesSection}>
                <h2 className={styles.sectionTitle}>Recommended Threat Queries</h2>
                <p className={styles.queriesSubtitle}>
                  Based on the entity graph — use these to surface Twitter exposure of energy-asset weaknesses.
                </p>
                <div className={styles.queriesGrid}>
                  {data.suggested_queries.map((sq, i) => (
                    <div key={i} className={styles.queryCard}>
                      <div className={styles.queryCategory}
                        style={{ color: categoryColors[sq.category] || "#9ca3af",
                                 borderColor: (categoryColors[sq.category] || "#9ca3af") + "44",
                                 background: (categoryColors[sq.category] || "#9ca3af") + "11" }}>
                        {sq.category}
                      </div>
                      <div className={styles.queryKeywords}>
                        {sq.keywords.map((kw) => (
                          <span key={kw} className={styles.keyword}>{kw}</span>
                        ))}
                      </div>
                      <p className={styles.queryReason}>{sq.reason}</p>
                      <button
                        className={styles.queryLaunch}
                        onClick={() =>
                          launchSearch(
                            `/search-query?keywords=${encodeURIComponent(sq.keywords.join(" "))}&from=entity-explorer`,
                          )
                        }
                      >
                        Launch search →
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Related dangerous tweets ── */}
            <section className={styles.tweetsSection}>
              <h2 className={styles.sectionTitle}>
                Related Dangerous Tweets
                {data.related_dangerous_tweets?.length > 0 && (
                  <span className={styles.tweetCount}>{data.related_dangerous_tweets.length}</span>
                )}
              </h2>

              {data.related_dangerous_tweets?.length === 0 && (
                <p className={styles.noTweets}>
                  No dangerous tweets mentioning this entity were found in the database.
                </p>
              )}

              {data.related_dangerous_tweets?.map((tweet) => (
                <article key={tweet._id} className={styles.tweetCard}>
                  <p className={styles.tweetContent}>{tweet.content}</p>
                  <div className={styles.tweetMeta}>
                    {tweet.username && <span>@{tweet.username}</span>}
                    {tweet.created_at && <span>{tweet.created_at.slice(0, 10)}</span>}
                    {tweet.category && (
                      <span className={styles.dangerBadge}>{tweet.category}</span>
                    )}
                    {tweet.url && (
                      <a href={tweet.url} target="_blank" rel="noreferrer">
                        Open tweet →
                      </a>
                    )}
                    <button
                      className={styles.detailLink}
                      onClick={() => navigate(`/tweet-detail/${tweet._id}`)}
                    >
                      View detail
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
