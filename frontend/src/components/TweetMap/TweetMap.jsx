import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import styles from "./TweetMap.module.css";

// Fix default marker icon broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CONFIDENCE_COLORS = {
  high: "#e53e3e",
  medium: "#dd6b20",
  low: "#718096",
};

function confidenceDot(confidence) {
  const color = CONFIDENCE_COLORS[confidence] || "#718096";
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px;vertical-align:middle;"></span>`;
}

// Inner component — must be rendered inside MapContainer to use useMap()
function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    const layer = L.heatLayer(points, {
      radius: 35,
      blur: 20,
      maxZoom: 10,
      // gradient: transparent → amber → deep red (darker = more tweets)
      gradient: { 0.0: "transparent", 0.3: "#fbbf24", 0.6: "#ef4444", 1.0: "#7f1d1d" },
    }).addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}

export default function TweetMap({ coordinates, queryId }) {
  const navigate = useNavigate();

  // Group by place_name → count occurrences, keep one representative lat/lng per place
  const uniquePlaces = useMemo(() => {
    if (!coordinates || coordinates.length === 0) return [];
    const map = {};
    for (const loc of coordinates) {
      const key = loc.place_name;
      if (!map[key]) {
        map[key] = { ...loc, count: 0 };
      }
      map[key].count++;
    }
    return Object.values(map);
  }, [coordinates]);

  // Heat points: [lat, lng, intensity] — intensity normalised 0–1
  const heatPoints = useMemo(() => {
    if (uniquePlaces.length === 0) return [];
    const maxCount = Math.max(...uniquePlaces.map((p) => p.count));
    return uniquePlaces.map((p) => [p.lat, p.lng, p.count / maxCount]);
  }, [uniquePlaces]);

  if (uniquePlaces.length === 0) return null;

  const center = [uniquePlaces[0].lat, uniquePlaces[0].lng];

  return (
    <div className={styles.mapWrapper}>
      <p className={styles.mapLabel}>Threat locations — darker = more tweets</p>
      <MapContainer
        center={center}
        zoom={uniquePlaces.length === 1 ? 10 : 6}
        className={styles.map}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <HeatLayer points={heatPoints} />

        {uniquePlaces.map((loc, i) => (
          <Marker key={i} position={[loc.lat, loc.lng]}>
            <Popup>
              <div className={styles.popup}>
                <strong>{loc.place_name}</strong>
                {loc.category && (
                  <span className={styles.popupTag}>{loc.category}</span>
                )}
                {loc.is_dangerous != null && (
                  <span className={loc.is_dangerous ? styles.popupDanger : styles.popupSafe}>
                    {loc.is_dangerous ? "Dangerous" : "Not dangerous"}
                  </span>
                )}
                <span className={styles.popupCount}>
                  {loc.count} tweet{loc.count !== 1 ? "s" : ""}
                </span>
                <button
                  className={styles.popupBtn}
                  onClick={() => {
                    const place = encodeURIComponent(loc.place_name);
                    navigate(
                      queryId
                        ? `/location-tweets/${queryId}?place=${place}`
                        : `/location-tweets?place=${place}`
                    );
                  }}
                >
                  View tweets →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
