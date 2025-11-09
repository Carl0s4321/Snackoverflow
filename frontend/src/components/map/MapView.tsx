import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const DEFAULT_CENTER: [number, number] = [-114.0719, 51.0447];
const CITY_BOUNDS: [mapboxgl.LngLatLike, mapboxgl.LngLatLike] = [
  [-114.30, 50.85],
  [-113.78, 51.20],
];

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

// This is a url
const COMMUNITY_DATA_URL =
  "https://data.calgary.ca/resource/surr-xmvs.geojson";

const MapView: FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (!mapboxgl.accessToken) {
      setStatusMessage("Missing Mapbox token. Please add VITE_MAPBOX_TOKEN.");
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: DEFAULT_CENTER,
      zoom: 8, // More zoomed out view
      minZoom: 2,
      maxZoom: 20,
      maxBounds: CITY_BOUNDS,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.on("load", async () => {
      try {
        // Fetch and load GeoJSON data
        const res = await fetch(COMMUNITY_DATA_URL);
        const data = await res.json();

        map.addSource("calgary-communities", {
          type: "geojson",
          data,
        });

        // Fill layer for communities
        map.addLayer({
          id: "communities-fill",
          type: "fill",
          source: "calgary-communities",
          paint: {
            "fill-color": "#38bdf8",
            "fill-opacity": 0.25,
          },
        });

        // Outline layer
        map.addLayer({
          id: "communities-outline",
          type: "line",
          source: "calgary-communities",
          paint: {
            "line-color": "#0f172a",
            "line-width": 1.2,
          },
        });

        // On click: send data to Flask (no popup)
        map.on("click", "communities-fill", async (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties || {};
          const name =
            props.name ||
            props.CommunityDistrict ||
            props.community ||
            props.community_name ||
            "Unknown Community";

          const geometry = feature.geometry;
          let coordinates: number[][] = [];

          if (geometry.type === "Polygon") {
            coordinates = geometry.coordinates[0];
          } else if (geometry.type === "MultiPolygon") {
            coordinates = geometry.coordinates[0][0];
          }

          // Calculate centroid
          const centroid = coordinates
            .reduce(
              (acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat],
              [0, 0]
            )
            .map((sum) => sum / coordinates.length);

          // Create payload
          const payload = {
            name,
            centroid: { lat: centroid[1], lon: centroid[0] },
          };

          // Send to Flask backend
          try {
            const response = await fetch("http://127.0.0.1:5000/api/community", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            const result = await response.json();
            console.log("Flask response:", result);
          } catch (error) {
            console.error("Error sending data to backend:", error);
          }
        });

        map.on("mouseenter", "communities-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "communities-fill", () => {
          map.getCanvas().style.cursor = "";
        });

        setStatusMessage("Loaded Calgary community boundaries!");
      } catch {
        setStatusMessage("Failed to load community boundaries.");
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-[100dvh] w-full bg-slate-900 text-white sm:h-screen">

      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
};

export default MapView;
