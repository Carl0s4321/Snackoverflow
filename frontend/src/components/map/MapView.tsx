import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import mapboxgl, { type GeoJSONFeature } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import ReportForm from "../reports/ReportForm";
import { useUserStore } from "../../stores/userStore";
import Sidebar from "../Sidebar";
import type { Pin } from "../types/types";

const DEFAULT_CENTER: [number, number] = [-114.0719, 51.0447];
const CITY_BOUNDS: [mapboxgl.LngLatLike, mapboxgl.LngLatLike] = [
  [-114.3, 50.85],
  [-113.78, 51.2],
];

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5000";

const COMMUNITY_DATA_URL = "https://data.calgary.ca/resource/surr-xmvs.geojson";

export const mockPins = [
  {
    id: 1,
    title: "Community Center",
    description: "This is a community center.",
    coordinates: [-114.0719, 51.0447],
    type: "info",
  },
  {
    id: 2,
    title: "Park",
    description: "Nice park for kids.",
    coordinates: [-114.058, 51.05],
    type: "park",
  },
  {
    id: 3,
    title: "School",
    description: "Nearby school.",
    coordinates: [-114.065, 51.048],
    type: "school",
  },
  {
    id: 4,
    title: "Restaurant",
    description: "Good food here.",
    coordinates: [-114.072, 51.046],
    type: "food",
  },
];

const MapView: FC = () => {
  const { user, fetchUser } = useUserStore();

  const [selectedPin, setSelectedPin] =
    useState<Pin | GeoJSONFeature | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const isLoggedIn = Boolean(user);

  useEffect(() => {
    if (!isLoggedIn) {
      setShowReportForm(false);
    }
  }, [isLoggedIn]);

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
      zoom: 8,
      minZoom: 2,
      maxZoom: 20,
      maxBounds: CITY_BOUNDS,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.on("load", async () => {
      try {
        const res = await fetch(COMMUNITY_DATA_URL);
        const data = await res.json();

        map.addSource("calgary-communities", {
          type: "geojson",
          data,
        });

        map.addLayer({
          id: "communities-fill",
          type: "fill",
          source: "calgary-communities",
          paint: {
            "fill-color": "#38bdf8",
            "fill-opacity": 0.25,
          },
        });

        map.addLayer({
          id: "communities-outline",
          type: "line",
          source: "calgary-communities",
          paint: {
            "line-color": "#0f172a",
            "line-width": 1.2,
          },
        });

        // PINSSSS
        mockPins.forEach((pin) => {
          const marker = new mapboxgl.Marker({
            color: pin.type === "park" ? "green" : "red",
          })
            .setLngLat(pin.coordinates as any)
            .addTo(map);

          marker.getElement().addEventListener("click", () => {
            map.flyTo({
              center: pin.coordinates as any,
              zoom: 14,
              speed: 1.2,
              curve: 1.4,
            });

            setSelectedPin(pin);
          });
        });

        // On click: show popup with name and centroid
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

          const centroid = coordinates
            .reduce(
              (acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat],
              [0, 0]
            )
            .map((sum) => sum / coordinates.length);

          const payload = {
            name,
            centroid: { lat: centroid[1], lon: centroid[0] },
          };

          try {
            const response = await fetch(`${API_BASE_URL}/api/communities`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            const result = await response.json();
            console.log("Community saved:", result);
          } catch (error) {
            console.error("Error sending community to backend:", error);
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
      {showReportForm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-xl">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="absolute -right-3 -top-3 rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white shadow"
              >
                Close
              </button>
              <ReportForm
                statusMessage={statusMessage}
                onSubmitted={() => setShowReportForm(false)}
                onClose={() => setShowReportForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {selectedPin && (
        <Sidebar
          pin={selectedPin}
          onClose={() => {
            setSelectedPin(null);
          }}
          showReportButton={isLoggedIn}
          onOpenReport={() => setShowReportForm(true)}
        />
      )}
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
};

export default MapView;
