import type { Pin } from "./types/types";
import type { GeoJSONFeature } from "mapbox-gl";
import Report from "./Report";

interface SidebarProps {
  pin: Pin | GeoJSONFeature | null;
  onClose: () => void;
}

export default function Sidebar({ pin, onClose }: SidebarProps) {
  if (!pin) return null;


  return (
    <div className="fixed top-0 right-0 w-80 h-full  text-black bg-white shadow-lg p-4 z-50">
      <button onClick={onClose} className="mb-4 text-red-500 font-bold">
        Close
      </button>
      {/* {("features" in pin) ? <Report pin={pin as any} /> : null } */}
    </div>
  );
}
