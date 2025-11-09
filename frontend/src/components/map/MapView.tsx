import React, { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapView: React.FC = () => {
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
  }, []);

  return <div ref={mapContainer} className="w-screen h-screen" />;
};

export default MapView;
