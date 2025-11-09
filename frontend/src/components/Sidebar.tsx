import { useUserStore } from "../stores/userStore";
import type { GeoJSONFeature } from "mapbox-gl";
// Importing all necessary types from the central types file
import type { Pin, CityQualityData, RatingDetail } from "./types/types.ts";

// Inline SVG component to replace lucide-react's Trash2 icon
const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

// Helper component for displaying key-value pairs
const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-start text-xs">
    <span className="font-semibold text-slate-600">{label}:</span>
    {/* flex-1 and min-w-0 ensures the value wraps if too long */}
    <span className="text-right text-slate-800 font-medium flex-1 min-w-0 break-words ml-2">
      {value}
    </span>
  </div>
);


interface SidebarProps {
  pin: Pin | GeoJSONFeature | null;
  onClose: () => void;
  // showReportButton is kept but no longer gates the report footer rendering
  showReportButton: boolean;
  onOpenReport: () => void;
  // Handler for deleting a user-created pin
  onDeletePin: () => void;
  // Now using the imported CityQualityData type
  cityQualityData: CityQualityData | null;
}

// Type guard to determine if the selected item is a user-created Pin
const isUserPin = (p: Pin | GeoJSONFeature | null): p is Pin => {
  // A pin is a user pin if it exists and does not have the GeoJSON 'properties' field
  return !!p && !("properties" in p);
};

export default function Sidebar({
  pin,
  onClose,
  // showReportButton is not used to conditionally render the button anymore
  showReportButton,
  onOpenReport,
  onDeletePin,
  cityQualityData, // Destructure the new prop
}: SidebarProps) {
  const { user } = useUserStore();

  // FIX: user?.id and pin.userId are now both typed as string, resolving the type overlap error.
  const isPinAuthor = isUserPin(pin) && user?.id === pin.userId;

  // Determine if the selected pin is a GeoJSON Feature (which can host quality scores)
  const isGeoJsonFeature = pin && "properties" in pin;

  // Still use this to determine if the sidebar should be open at all
  if (!pin && !showReportButton) return null;

  const pinTitle = (() => {
    if (!pin) return null;
    if (isGeoJsonFeature && pin.properties) {
      const props = pin.properties as Record<string, unknown>;
      return (
        (props.name as string) ||
        (props.CommunityDistrict as string) ||
        "Community District"
      );
    }
    return (pin as Pin).title;
  })();

  const pinDescription = (() => {
    if (!pin) return null;
    if (isGeoJsonFeature && pin.properties) {
      const props = pin.properties as Record<string, unknown>;
      return (
        (props.description as string) ||
        (props.notes as string) ||
        "No additional details available."
      );
    }
    return (pin as Pin).description;
  })();

  // Utility function to determine color based on score (Tailwind classes)
  const getScoreColor = (score: number) => {
    if (score >= 7.5) return 'text-emerald-600 bg-emerald-50 border-emerald-300'; // High score
    if (score >= 5.0) return 'text-yellow-600 bg-yellow-50 border-yellow-300'; // Moderate score
    return 'text-red-600 bg-red-50 border-red-300'; // Low score
  };

  return (
    // Updated container to use flex-col for separating scrollable content and fixed footer
    <div className="fixed right-0 top-0 z-40 h-full w-80 bg-white text-black shadow-2xl flex flex-col">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 pt-20">
        <div className="border-b border-slate-200 pb-3">
          <h1 className="text-xl font-bold text-slate-900">Map Context</h1>
          <p className="text-xs text-slate-500">
            View selected location details and actions.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {pin ? pinTitle : "Actions"}
          </h2>
          {pin && (
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
            >
              Close
            </button>
          )}
        </div>

        {/* --- DISPLAY PIN / FEATURE DETAILS --- */}
        {pin ? (
          <div className="mt-4 space-y-4">

            {/* NEW: 1. Report Pin Details (Only for user-created pins) */}
            {isUserPin(pin) && (
              <div className="space-y-3 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wider border-b border-indigo-300 pb-1">
                  Report Snapshot
                </h3>
                {/* Accessing category using type assertion as it's implied by the JSON context */}
                <DetailItem label="Category" value={(pin as any).category || 'General Issue'} />
                {/* FIX START: Conditional check to prevent passing undefined to new Date() */}
                <DetailItem
                  label="Reported On"
                  value={
                    (pin as Pin).createdAt
                      ? new Date((pin as Pin).createdAt!).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'Date Unavailable'
                  }
                />
                {/* FIX END */}

                {/* Displaying full userId with monospace font for clarity */}
                <div className="flex justify-between items-start text-xs">
                    <span className="font-semibold text-slate-600">Reported By:</span>
                    <span className="text-right text-slate-800 font-mono text-[10px] bg-slate-100 p-1 rounded-sm max-w-[50%] overflow-x-auto whitespace-nowrap ml-2">
                        {(pin as Pin).userId || 'Anonymous'}
                    </span>
                </div>

                <DetailItem label="Coordinates" value={`${(pin as Pin).latitude.toFixed(4)}, ${(pin as Pin).longitude.toFixed(4)}`} />
              </div>
            )}

            {/* 2. Display Description / Message */}
            {/* Show description for user-pins OR for GeoJSON features without the quality data loaded yet */}
            {(!cityQualityData || isUserPin(pin)) && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-semibold uppercase text-slate-500 mb-1">Description</h4>
                    <p className="text-sm text-slate-700">
                        {isUserPin(pin) ? (pin as Pin).description : pinDescription}
                    </p>
                </div>
            )}


            {/* --- QUALITY SCORE DISPLAY (NEW) --- */}
            {isGeoJsonFeature && cityQualityData && (
              <div className="space-y-4">
                {/* 1. Overall Score Index */}
                <div className="p-4 rounded-xl bg-indigo-600 shadow-lg text-white">
                  <p className="text-xs font-medium opacity-80">Composite Quality Index</p>
                  <div className="flex justify-between items-end mt-1">
                    <span className="text-4xl font-extrabold tracking-tight">
                      {cityQualityData.city_quality_score.toFixed(1)}
                    </span>
                    <span className="text-xl font-semibold opacity-90">/ 10</span>
                  </div>
                  <p className="text-xs mt-2 opacity-80">
                    {cityQualityData.message || "Score derived from multiple environmental inputs."}
                  </p>
                </div>

                {/* 2. Individual Ratings Breakdown */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">Contributing Factors</h3>
                  {Object.entries(cityQualityData.individual_ratings).map(([key, rating]: [string, RatingDetail]) => {
                    const scoreColorClasses = getScoreColor(rating.score).split(' ');
                    const textColor = scoreColorClasses[0];
                    const bgColor = scoreColorClasses[1];
                    const borderColor = scoreColorClasses[2];

                    return (
                      <div
                        key={key}
                        // Add title for hover text/tooltip (shows description)
                        title={`${rating.description} (Weight: ${(rating.weight * 100).toFixed(0)}%)`}
                        className={`flex justify-between items-center p-3 rounded-md border cursor-help transition-all ${bgColor} ${borderColor}`}
                      >
                        {/* Format key nicely (e.g., 'air_quality' -> 'Air Quality') */}
                        <span className="text-sm font-medium capitalize text-slate-800">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-sm font-bold ${textColor}`}>
                          {rating.score.toFixed(1)} / 10
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* --- END QUALITY SCORE DISPLAY --- */}

            {/* Conditional Delete Button for the Pin Author */}
            {isPinAuthor && (
              <button
                type="button"
                onClick={onDeletePin}
                className="flex items-center space-x-1 text-xs font-semibold text-red-600 hover:text-red-800 pt-2 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                <span>Delete My Pin</span>
              </button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Select a marker to inspect details or use the report button below to submit a new observation.
          </p>
        )}
      </div>

      {/* --- REPORT BUTTON (FIXED FOOTER) --- */}
      <div className="p-4 pt-0">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
          <p className="text-sm font-medium text-slate-700">
            Found a problem? Capture a snapshot and submit a report!
          </p>
          <button
            type="button"
            onClick={onOpenReport}
            className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition-colors transform hover:scale-[1.01]"
          >
            Create New Report
          </button>
        </div>
      </div>
    </div>
  );
}