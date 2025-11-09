import type { ChangeEvent, FC, FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const DEFAULT_CENTER: [number, number] = [-114.0719, 51.0447];
const CITY_BOUNDS: [mapboxgl.LngLatLike, mapboxgl.LngLatLike] = [
  [-114.3, 50.85],
  [-113.78, 51.2],
];

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5000";

const COMMUNITY_DATA_URL =
  "https://data.calgary.ca/resource/surr-xmvs.geojson";

const MapView: FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setFormMessage("Geolocation is not supported on this device.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setFormMessage(null);
        setIsLocating(false);
      },
      (err) => {
        setFormMessage(err.message || "Unable to fetch location.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

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
            const response = await fetch(
              `${API_BASE_URL}/api/community`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }
            );

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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setPhotoFile(event.target.files[0]);
      setFormMessage(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!photoFile) {
      setFormMessage("Please take or select a photo before submitting.");
      return;
    }

    if (!location) {
      setFormMessage("Waiting for live location. Try refreshing it first.");
      return;
    }

    const formData = new FormData();
    formData.append("photo", photoFile);
    formData.append("lat", location.lat.toString());
    formData.append("lon", location.lon.toString());
    if (notes.trim()) {
      formData.append("notes", notes.trim());
    }

    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/submissions/photo`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Upload failed.");
      }

      setFormMessage("Thanks! Your snapshot was uploaded successfully.");
      setPhotoFile(null);
      setNotes("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setFormMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-full bg-slate-900 text-white sm:h-screen">
      <div className="absolute left-4 top-4 z-10 w-full max-w-sm rounded-2xl border border-white/20 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur">
        <h2 className="text-lg font-semibold">Share a live snapshot</h2>
        <p className="text-sm text-slate-600">
          Capture what you see, and we will pin it to your current location.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-800">
            Photo
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1 file:text-white"
          />
          {photoFile ? (
            <p className="text-xs text-slate-500">
              {photoFile.name} ({(photoFile.size / 1024).toFixed(0)} KB)
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Tip: On mobile, this opens your camera.
            </p>
          )}

          <div className="flex items-center justify-between rounded-xl bg-slate-100 p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Live location</p>
              <p className="text-xs text-slate-600">
                {location
                  ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`
                  : "Waiting for GPS..."}
              </p>
            </div>
            <button
              type="button"
              onClick={requestLocation}
              disabled={isLocating}
              className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLocating ? "Locating..." : "Refresh"}
            </button>
          </div>

          <label className="block text-sm font-medium text-slate-800">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="Add context about what you are seeing."
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Uploading..." : "Send snapshot"}
          </button>
        </form>
        {formMessage && (
          <p className="mt-2 text-sm text-slate-700">{formMessage}</p>
        )}
        {statusMessage && (
          <p className="mt-1 text-xs text-slate-500">Map: {statusMessage}</p>
        )}
      </div>
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
};

export default MapView;
