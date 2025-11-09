import { useUserStore } from "../stores/userStore";
import type { Pin } from "./types/types";
import type { GeoJSONFeature } from "mapbox-gl";

interface SidebarProps {
  pin: Pin | GeoJSONFeature | null;
  onClose: () => void;
  showReportButton: boolean;
  onOpenReport: () => void;
}

export default function Sidebar({
  pin,
  onClose,
  showReportButton,
  onOpenReport,
}: SidebarProps) {
    if (!pin && !showReportButton) return null;
    
    const { user } = useUserStore();

  const pinTitle = (() => {
    if (!pin) return null;
    if ("properties" in pin && pin.properties) {
      const props = pin.properties as Record<string, unknown>;
      return (
        (props.name as string) ||
        (props.CommunityDistrict as string) ||
        "Community"
      );
    }
    return (pin as Pin).title;
  })();

  const pinDescription = (() => {
    if (!pin) return null;
    if ("properties" in pin && pin.properties) {
      const props = pin.properties as Record<string, unknown>;
      return (
        (props.description as string) ||
        (props.notes as string) ||
        "No additional details available."
      );
    }
    return (pin as Pin).description;
  })();

  return (
    <div className="fixed right-0 top-0 z-40 h-full w-80 bg-white text-black shadow-lg">
      <div className="h-full overflow-y-auto p-4 pt-20">
        <div className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-bold text-slate-900">Community Panel</h1>
        <p className="text-xs text-slate-500">
          View map context or open the reporting tools.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {pin ? "Location details" : "Actions"}
        </h2>
        {pin && (
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        )}
      </div>

      {pin ? (
        <div className="mt-4 space-y-2 text-sm">
          <p className="text-base font-semibold">{pinTitle}</p>
          <p className="text-slate-700">{pinDescription}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">
          Select a marker to inspect details or open the report form below.
        </p>
      )}

      {showReportButton && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-600">
            Ready to capture a webcam snapshot and submit a report?
          </p>
          <button
            type="button"
            onClick={onOpenReport}
            className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
          >
            Create report
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
