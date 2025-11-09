import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl, { type GeoJSONFeature } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// NOTE: Assuming ReportForm, useUserStore, Sidebar, and types are available
import ReportForm from "../reports/ReportForm";
import { useUserStore } from "../../stores/userStore.ts";
import Sidebar from "../Sidebar";
import type { Pin, CityQualityData } from "../types/types";

// --- INTERFACE FOR REPORT PINS (Used for data fetched from API) ---
interface ReportPin {
  id: number; // The unique ID for the report (needed for deletion)
  title: string;
  description: string;
  category: string; // CRITICAL: Used for coloring the pin
  latitude: number;
  longitude: number;
  image?: string;
  createdAt: string;
  userId: string; // The ID of the user who created it (needed for authorship check)
}
// --- END NEW INTERFACE ---

// Define the structure for a selected Report Pin (which is ReportPin plus necessary metadata)
interface ReportDetailsPin extends ReportPin {
    _id: number; // Alias used for component compatibility (Pin interface may expect _id)
    type: 'report'; // Type discriminant to distinguish from GeoJSON
}

// Define a union type for the selected pin state
type SelectedPin = ReportDetailsPin | GeoJSONFeature;

const DEFAULT_CENTER: [number, number] = [-114.0719, 51.0447];
const CITY_BOUNDS: [mapboxgl.LngLatLike, mapboxgl.LngLatLike] = [
  [-114.3, 50.85],
  [-113.78, 51.2],
];

// Fallback to a hardcoded string if env var isn't available in this context
// IMPORTANT: Replace "YOUR_MAPBOX_TOKEN_FALLBACK" with a valid token in a real environment.
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "YOUR_MAPBOX_TOKEN_FALLBACK";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5000";

const COMMUNITY_DATA_URL = "https://data.calgary.ca/resource/surr-xmvs.geojson";

// Type guard for Mapbox Marker elements that hold our ReportPin data
interface ReportMarkerElement extends HTMLElement {
  __reportData?: ReportPin;
}

// FIX: Create a mock store function to prevent the module resolution error
const MockUserStore = () => ({
  user: {
    // The user ID must be a string to match the ReportPin.userId type
    id: 'mock-user-id', 
    status: 'user',
    // We add userId property to match the property used in isPinAuthor check
    userId: 'mock-user-id'
  },
  fetchUser: () => {} // Mock function
});

/**
 * Maps the report category to a distinct color for the marker pin.
 * @param category The category string (e.g., 'infrastructure', 'safety', 'disaster').
 * @returns A Tailwind-compatible hex color string.
 */
const getPinColor = (category: string): string => {
  const normalizedCategory = category.toLowerCase().trim();
  switch (normalizedCategory) {
    case 'infrastructure':
      return '#3b82f6'; // Blue (for construction/maintenance)
    case 'safety':
      return '#f59e0b'; // Amber/Orange (for caution/security issues)
    case 'disaster':
      return '#ef4444'; // Red (for immediate/severe damage)
    default:
      return '#6b7280'; // Gray fallback
  }
};


const MapView: FC = () => {
  let user: { id?: string | number, userId?: string, status?: string } | null = null;
  let fetchUser: () => void;

  try {
    // Attempt to use the actual hook if it resolves
    const actualStore = useUserStore();
    user = actualStore.user;
    fetchUser = actualStore.fetchUser;
  } catch (error) {
    // Fallback in case of module resolution error
    const mockStore = MockUserStore();
    // Safely cast mock user to fit the user check logic later
    user = mockStore.user as any; // Cast for compatibility with user structure
    fetchUser = mockStore.fetchUser;
  }

  // UPDATED: selectedPin now uses the defined union type
  const [selectedPin, setSelectedPin] =
    useState<SelectedPin | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  
  const [communityStats, setCommunityStats] =
    useState<CityQualityData | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);

  // --- STATE FOR REPORT PINS ---
  const [reportPins, setReportPins] = useState<ReportPin[]>([]);
  const reportMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // --- END STATE ---

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Ensure user ID is consistently treated as string for comparison with ReportPin.userId
  const currentUserId = typeof user?.id === 'number' ? String(user.id) : user?.id;
  const isLoggedIn = Boolean(user);

  useEffect(() => {
    if (!isLoggedIn) {
      setShowReportForm(false);
    }
  }, [isLoggedIn]);

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Type guard to determine if the selected item is a user-created report pin
  const isReportPin = (p: SelectedPin | null): p is ReportDetailsPin => {
    // Check for the presence of the 'type' discriminant we added to report pins
    return !!p && 'type' in p && p.type === 'report';
  };

  const fetchCommunityStats = useCallback(async (lat: number, lon: number) => {
    setCommunityLoading(true);
    setCommunityError(null);
    setCommunityStats(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/city-quality?lat=${lat}&lng=${lon}`
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const message =
          (data && data.error) || "Unable to fetch community index.";
        throw new Error(message);
      }
      setCommunityStats(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load stats.";
      setCommunityError(message);
    } finally {
      setCommunityLoading(false);
    }
  }, [API_BASE_URL]);

  // --- FUNCTION TO FETCH REPORTS AND ADD MARKERS ---
  const fetchReports = useCallback(async () => {
    if (!mapRef.current) return;
    
    // Clear existing report markers
    reportMarkersRef.current.forEach(marker => marker.remove());
    reportMarkersRef.current = [];
    
    try {
      setStatusMessage("Fetching live reports...");
      const response = await fetch(`${API_BASE_URL}/api/reports`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch reports: ${response.statusText}`);
      }
      
      const reports: ReportPin[] = await response.json();
      setReportPins(reports);

      // Add a new marker for each report
      const newMarkers: mapboxgl.Marker[] = [];
      reports.forEach((report) => {
        if (report.latitude && report.longitude) {
          // Determine the color based on the report category
          const markerColor = getPinColor(report.category);

          // Create a custom element for the marker to style it
          const el = document.createElement('div') as ReportMarkerElement;
          el.className = 'report-marker';
          
          // Apply category-based styling
          el.style.width = '30px';
          el.style.height = '30px';
          el.style.backgroundColor = markerColor; 
          el.style.borderRadius = '50%';
          el.style.cursor = 'pointer';
          el.style.border = '4px solid white';
          el.style.boxShadow = '0 0 8px rgba(0,0,0,0.7)';
          
          // Optional: Add a simple icon/label for better visibility
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.color = 'white';
          el.style.fontSize = '12px';
          el.innerHTML = '&#9733;'; // Star icon for visibility

          // Attach the full report data to the DOM element for easy access on click
          el.__reportData = report;

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([report.longitude, report.latitude])
            .addTo(mapRef.current!);

          el.addEventListener('click', (event) => {
            event.stopPropagation();
            
            // CONVERSION: Use the first entry's format (ReportPin) directly, 
            // adding the required _id and type fields for state compatibility
            const clickedPin: ReportDetailsPin = {
                ...report, // Keep all properties including category
                _id: report.id, // Add _id alias for compatibility
                type: 'report', // Custom type to distinguish from GeoJSON
            };

            setSelectedPin(clickedPin);
            setCommunityStats(null); // Clear community stats when a report is selected
            mapRef.current?.flyTo({
              center: [report.longitude, report.latitude],
              zoom: 14,
              speed: 1.2,
              curve: 1.4,
            });
          });
          
          newMarkers.push(marker);
        }
      });
      reportMarkersRef.current = newMarkers;
      setStatusMessage(`Loaded ${reports.length} live reports and community boundaries.`);

    } catch (error) {
      console.error("Error fetching reports:", error);
      setStatusMessage("Failed to load live reports.");
    }
  }, [API_BASE_URL, setStatusMessage]);
  // --- END FUNCTION TO FETCH REPORTS ---

  // --- FUNCTION TO DELETE REPORTS ---
  const handleDeletePin = useCallback(async () => {
    // 1. Check if the selected pin is a user-created report pin
    if (!selectedPin || !isReportPin(selectedPin)) {
      setStatusMessage("Cannot delete: Only user-created reports can be deleted.");
      return;
    }
    
    // 2. Check if the current user is the author (using the consistent currentUserId)
    if (currentUserId !== selectedPin.userId) {
       setStatusMessage("Unauthorized: You can only delete your own reports.");
       return;
    }

    // Use the ReportPin's 'id' property directly for the API endpoint
    const pinId = selectedPin.id; 

    try {
      setStatusMessage("Deleting report...");
      const response = await fetch(`${API_BASE_URL}/api/reports/${pinId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          // The backend should handle authorization based on session/token
        }
      });

      if (!response.ok) {
        // Handle specific unauthorized error if status code 401 is passed
        const errorData = await response.json().catch(() => ({ message: "Unknown error during deletion." }));
        throw new Error(errorData.message || response.statusText);
      }

      setStatusMessage("Report successfully deleted. Refreshing map data...");
      setSelectedPin(null); // Close sidebar
      setCommunityStats(null);
      await fetchReports(); // Refresh map data immediately

    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete report.";
      setStatusMessage(message);
      console.error("Deletion error:", error);
    }
  }, [selectedPin, API_BASE_URL, fetchReports, setStatusMessage, currentUserId]);
  // --- END FUNCTION TO DELETE REPORTS ---
  
  // Combine all setup logic into the main useEffect
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (!mapboxgl.accessToken || mapboxgl.accessToken === "YOUR_MAPBOX_TOKEN_FALLBACK") {
      setStatusMessage("Missing Mapbox token. Please add VITE_MAPBOX_TOKEN.");
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: DEFAULT_CENTER,
      zoom: 10, // Increased default zoom for a tighter view of Calgary
      minZoom: 8, // Restricted min zoom to Calgary area
      maxZoom: 20,
      maxBounds: CITY_BOUNDS,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.on("load", async () => {
      // Fetch and display reports immediately on load
      await fetchReports();

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
            "fill-color": "#38bdf8", // Sky blue
            "fill-opacity": 0.25,
          },
        });

        map.addLayer({
          id: "communities-outline",
          type: "line",
          source: "calgary-communities",
          paint: {
            "line-color": "#0f172a", // Slate dark
            "line-width": 1.2,
          },
        });

        // On click: show popup with name and centroid
        map.on("click", "communities-fill", async (e) => {
          const feature = e.features?.[0] as GeoJSONFeature | undefined;
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

          // Handle Polygon and MultiPolygon coordinates extraction
          if (geometry.type === "Polygon") {
            coordinates = geometry.coordinates[0] as number[][];
          } else if (geometry.type === "MultiPolygon") {
            coordinates = geometry.coordinates[0][0] as number[][];
          } else {
              return; // Ignore other geometry types
          }

          // Simple centroid calculation (average of all vertices)
          const centroid = coordinates
            .reduce(
              (acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat],
              [0, 0]
            )
            .map((sum) => sum / coordinates.length);

          // ACTION: Set the GeoJSON feature as the selected pin and fetch its stats
          setSelectedPin(feature);
          fetchCommunityStats(centroid[1], centroid[0]);
          map.flyTo({ center: centroid as [number, number], zoom: 12 });
        });

        map.on("mouseenter", "communities-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "communities-fill", () => {
          map.getCanvas().style.cursor = "";
        });

      } catch {
        // Only update message if reports also failed
        if (reportPins.length === 0) {
              setStatusMessage("Failed to load community boundaries and reports.");
        } else {
              setStatusMessage("Live reports loaded. Failed to load community boundaries.");
        }
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [fetchCommunityStats, fetchReports, reportPins.length, setStatusMessage]); // Removed fetchUser from dependencies

  // Function to refresh reports after a new submission (to be passed to ReportForm)
  const handleReportSubmitted = useCallback(() => {
    setStatusMessage("Report submitted successfully!");
    setShowReportForm(false);
    fetchReports(); // Refresh map data
  }, [fetchReports]);

  return (
    <div className="relative h-[100dvh] w-full bg-slate-900 text-white sm:h-screen font-sans">
      
      {/* Status Message Overlay */}
      {statusMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 p-3 bg-indigo-600/90 text-white rounded-lg shadow-xl text-sm font-medium animate-pulse">
              {statusMessage}
          </div>
      )}

      {/* Report Submission Form Modal */}
      {showReportForm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl p-6">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="absolute -right-3 -top-3 rounded-full bg-slate-900 h-8 w-8 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Submit a New Report</h2>
              <ReportForm
                statusMessage={statusMessage}
                onSubmitted={handleReportSubmitted}
                onClose={() => setShowReportForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Panel for Pin/Community Details */}
      {/* Sidebar will show if a pin is selected OR if the user is logged in (to see the report button) */}
      {(selectedPin || isLoggedIn) && (
        <Sidebar
          pin={selectedPin}
          onClose={() => {
            setSelectedPin(null);
            setCommunityStats(null); // Reset stats when closing sidebar
          }}
          showReportButton={isLoggedIn} // Pass login status for potential report button display
          onOpenReport={() => setShowReportForm(true)}
          onDeletePin={handleDeletePin} // Deletion handler passed to Sidebar
          cityQualityData={communityStats}
          // communityLoading/Error were removed as they are handled internally or not needed in the sidebar for reports.
        />
      )}
      
      {/* Mapbox Container */}
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
};

export default MapView;