import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import styles from "./ThreatThemes.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

const CATEGORIES = ["Oil", "Gas", "Electricity", "Other"];

const CLUSTER_COLORS = [
  "#6366f1",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function getClusterColor(clusterId, index) {
  if (clusterId === -1) return "#9ca3af";
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}

export default function ThreatThemes() {
  const navigate = useNavigate();

  const [category, setCategory] = useState("Oil");
  const [limit, setLimit] = useState(100);
  const [minClusterSize, setMinClusterSize] = useState(2);
  const [minSamples, setMinSamples] = useState(1);

  const [data, setData] = useState(null);
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleCluster(e) {
    e.preventDefault();
    setMessage("");
    setData(null);
    setSelectedClusterId(null);

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${SERVER_URL}/threat-themes/cluster?category=${encodeURIComponent(
          category
        )}&limit=${limit}&min_cluster_size=${minClusterSize}&min_samples=${minSamples}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result?.detail || "Failed to cluster threat themes.");
        return;
      }

      setData(result);

      const firstCluster = result.clusters?.[0];
      if (firstCluster) setSelectedClusterId(firstCluster.cluster_id);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  const selectedCluster =
    data?.clusters?.find((cluster) => cluster.cluster_id === selectedClusterId) ||
    null;

  const points = data?.points || [];

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back home
        </button>

        <h1 className={styles.title}>Threat Themes</h1>
        <p className={styles.subtitle}>
          Cluster dangerous tweets by category. The graph shows the 2D projection
          of tweet embeddings, and the list below shows tweets grouped by cluster.
        </p>

        <form className={styles.controls} onSubmit={handleCluster}>
          <div>
            <label className={styles.label}>Category</label>
            <select
              className={styles.input}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={styles.label}>Limit</label>
            <input
              className={styles.input}
              type="number"
              min="5"
              max="500"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className={styles.label}>Min cluster size</label>
            <input
              className={styles.input}
              type="number"
              min="2"
              max="50"
              value={minClusterSize}
              onChange={(e) => setMinClusterSize(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className={styles.label}>Min samples</label>
            <input
              className={styles.input}
              type="number"
              min="1"
              max="50"
              value={minSamples}
              onChange={(e) => setMinSamples(e.target.value)}
              disabled={loading}
            />
          </div>

          <button className={styles.submitButton} type="submit" disabled={loading}>
            {loading ? "Clustering..." : "Run clustering"}
          </button>
        </form>

        {message && <p className={styles.message}>{message}</p>}

        {data && (
          <>
            <section className={styles.summary}>
              <div>
                <strong>{data.total_tweets}</strong>
                <span>Total dangerous tweets</span>
              </div>
              <div>
                <strong>{data.embedded_tweets}</strong>
                <span>Embedded tweets</span>
              </div>
              <div>
                <strong>{data.clusters?.length || 0}</strong>
                <span>Clusters found</span>
              </div>
            </section>

            <section className={styles.chartSection}>
              <h2 className={styles.sectionTitle}>Semantic cluster map</h2>

              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height={380}>
                  <ScatterChart>
                    <CartesianGrid />
                    <XAxis type="number" dataKey="x" name="x" />
                    <YAxis type="number" dataKey="y" name="y" />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload;

                        return (
                          <div className={styles.tooltip}>
                            <strong>
                              {item.cluster_id === -1
                                ? "Noise"
                                : `Threat theme ${item.cluster_id}`}
                            </strong>
                            <p>{item.content}</p>
                          </div>
                        );
                      }}
                    />
                    <Legend />

                    {data.clusters?.map((cluster, index) => {
                      const clusterPoints = points.filter(
                        (point) => point.cluster_id === cluster.cluster_id
                      );

                      return (
                        <Scatter
                          key={cluster.cluster_id}
                          name={cluster.label}
                          data={clusterPoints}
                          fill={getClusterColor(cluster.cluster_id, index)}
                        />
                      );
                    })}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className={styles.clustersSection}>
              <h2 className={styles.sectionTitle}>Tweets by cluster</h2>

              <div className={styles.clusterLayout}>
                <aside className={styles.clusterSidebar}>
                  {data.clusters.map((cluster, index) => (
                    <button
                      key={cluster.cluster_id}
                      className={`${styles.clusterButton} ${
                        selectedClusterId === cluster.cluster_id
                          ? styles.activeCluster
                          : ""
                      }`}
                      onClick={() => setSelectedClusterId(cluster.cluster_id)}
                    >
                      <span>
                        <span
                          style={{
                            display: "inline-block",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            marginRight: "8px",
                            background: getClusterColor(cluster.cluster_id, index),
                          }}
                        />
                        {cluster.label}
                      </span>
                      <strong>{cluster.count}</strong>
                    </button>
                  ))}
                </aside>

                <div className={styles.tweetsPanel}>
                  <h3 className={styles.clusterTitle}>
                    {selectedCluster?.label || "Select a cluster"}
                  </h3>

                  {selectedCluster?.tweets?.map((tweet) => (
                    <article className={styles.tweetCard} key={tweet._id}>
                      <p>{tweet.content}</p>

                      <div className={styles.tweetMeta}>
                        <span>@{tweet.username || "unknown"}</span>
                        <span>{tweet.created_at?.slice(0, 10)}</span>
                        {tweet.url && (
                          <a href={tweet.url} target="_blank" rel="noreferrer">
                            Open tweet
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}