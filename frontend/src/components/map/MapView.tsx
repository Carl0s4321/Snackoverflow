import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useUserStore } from "../../stores/userStore";

const DEFAULT_CENTER: [number, number] = [-114.0719, 51.0447];
const CITY_BOUNDS: [mapboxgl.LngLatLike, mapboxgl.LngLatLike] = [
  [-114.3, 50.85],
  [-113.78, 51.2],
];

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

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
  useEffect(() => {
    fetchUser();
  }, []);

  const isAdmin = user?.status === "admin";
  console.log("isAdmin", isAdmin);

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

        // PINSSSS
        mockPins.forEach((pin) => {
          const marker = new mapboxgl.Marker({ color: pin.type === "park" ? "green" : "red" })
            .setLngLat(pin.coordinates as any)
            .setPopup(
              new mapboxgl.Popup({ offset: 25 }).setHTML(
                `<h3>${pin.title}</h3><p>${pin.description}</p>`
              )
            )
            .addTo(map);
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
            .reduce((acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat], [0, 0])
            .map((sum) => sum / coordinates.length);

          const payload = {
            name,
            centroid: { lat: centroid[1], lon: centroid[0] },
            // coordinates,
          };

          try {
            const response = await fetch(
              "http://127.0.0.1:5000/api/community",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              }
            );

            const result = await response.json();
            console.log("Flask response:", result);
          } catch (error) {
            console.error("Error sending data to backend:", error);
          }

          new mapboxgl.Popup()
            .setLngLat(centroid as [number, number])
            .setHTML(
              `
              <strong>${name}</strong><br/>
              Lat: ${centroid[1].toFixed(5)}, Lon: ${centroid[0].toFixed(5)}
            `
            )
            .addTo(map);
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
      <div className="absolute left-1/2 top-3 z-20 flex w-[94%] max-w-4xl -translate-x-1/2 flex-col gap-2 rounded-2xl bg-slate-900/85 p-4 text-sm shadow-lg backdrop-blur-sm sm:top-4">
        <p className="text-base font-semibold text-white sm:text-lg">
          Calgary Community Map
        </p>
        <p className="text-xs text-slate-300">
          Click a community to view its location.
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
