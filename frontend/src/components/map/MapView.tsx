import React, { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useUserStore } from "../../stores/userStore";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;


// mockPins.ts
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
    coordinates: [-114.058, 51.050], 
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



const MapView: React.FC = () => {
  const { user, fetchUser } = useUserStore();
  useEffect(() => {
    fetchUser();
  }, []);

  const isAdmin = user?.status === "admin";
  console.log("isAdmin", isAdmin);

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-114.0719, 51.0447],
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    mockPins.forEach((pin) => {
      const marker = new mapboxgl.Marker({ color: pin.type === "park" ? "green" : "red" })
        .setLngLat(pin.coordinates as any)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<h3>${pin.title}</h3><p>${pin.description}</p>`
          )
        )
        .addTo(map.current!);
    });

  }, []);

  return <div ref={mapContainer} className="w-screen h-screen" />;
};

export default MapView;
