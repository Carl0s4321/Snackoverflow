import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// --- Calgary setup ---
const DEFAULT_CENTER: [number, number] = [-114.0719, 51.0447];
const CITY_BOUNDS: [mapboxgl.LngLatLike, mapboxgl.LngLatLike] = [
  [-114.30, 50.85],
  [-113.78, 51.20],
];

// 🔑 Your Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

// 🔗 GeoJSON source (from the Calgary Open Data portal)
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
      zoom: 11,
      minZoom: 9,
      maxZoom: 15,
      maxBounds: CITY_BOUNDS,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    // Wait for the map style to finish loading
    map.on("load", async () => {
      try {
        // Add GeoJSON source
        map.addSource("calgary-communities", {
          type: "geojson",
          data: COMMUNITY_DATA_URL,
        });

        // Add fill layer
        map.addLayer({
          id: "communities-fill",
          type: "fill",
          source: "calgary-communities",
          paint: {
            "fill-color": "#38bdf8",
            "fill-opacity": 0.25,
          },
        });

        // Add outline layer
        map.addLayer({
          id: "communities-outline",
          type: "line",
          source: "calgary-communities",
          paint: {
            "line-color": "#0f172a",
            "line-width": 1.2,
          },
        });

        // Click handler to show popup
        map.on("click", "communities-fill", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          // The property names differ — inspect them first in console if undefined
          const props = feature.properties || {};
          const name =
            props.CommunityDistrict ||
            props.community ||
            props.name ||
            "Unknown Community";

          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<strong>${name}</strong>`)
            .addTo(map);
        });

        // Change cursor on hover
        map.on("mouseenter", "communities-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "communities-fill", () => {
          map.getCanvas().style.cursor = "";
        });

        setStatusMessage("Loaded Calgary community boundaries!");
      } catch (error) {
        console.error(error);
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
      <div className="absolute left-1/2 top-3 z-20 flex w-[94%] max-w-4xl -translate-x-1/2 flex-col gap-2 rounded-2xl bg-slate-900/85 p-4 text-sm shadow-lg backdrop-blur-sm sm:top-4">
        <p className="text-base font-semibold text-white sm:text-lg">
          Calgary Community Map
        </p>
        <p className="text-xs text-slate-300">
          Click a polygon to view its community district name.
        </p>
        {statusMessage && (
          <p className="text-cyan-400 text-xs mt-1">{statusMessage}</p>
        )}
      </div>

      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
};

export default MapView;
