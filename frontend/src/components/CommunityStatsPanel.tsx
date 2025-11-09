import type { FC } from "react";
import type { CommunityQuality } from "./types/types";

interface Props {
  communityName: string;
  coordinates: { lat: number; lon: number };
  stats: CommunityQuality | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onCreateReport: () => void;
  isLoggedIn: boolean;
}

const CommunityStatsPanel: FC<Props> = ({
  communityName,
  coordinates,
  stats,
  loading,
  error,
  onClose,
  onCreateReport,
  isLoggedIn,
}) => {
  const scoreEntries = stats ? Object.entries(stats.scores ?? {}) : [];

  return (
    <div className="fixed right-0 top-0 z-30 h-full w-[min(420px,92vw)] overflow-y-auto border-l border-slate-200 bg-white pt-20 text-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 pt-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Community index
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">
            {communityName}
          </h2>
          <p className="text-xs text-slate-500">
            Lat {coordinates.lat.toFixed(3)} / Lon {coordinates.lon.toFixed(3)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      <div className="space-y-5 px-5 pb-8 pt-6">
        {loading && (
          <p className="text-sm text-slate-600">
            Pulling live index for this neighbourhood...
          </p>
        )}
        {error && <p className="text-sm text-rose-500">{error}</p>}
        {!loading && !error && stats && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Overall index
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold text-slate-900">
                  {stats.city_quality_score.toFixed(1)}
                </span>
                <span className="text-sm text-slate-500">/ 10</span>
              </div>
              <p className="text-sm text-slate-600">
                {stats.message || "Composite of air quality and weather inputs."}
              </p>
            </div>

            {scoreEntries.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Factors
                </p>
                {scoreEntries.map(([factor, detail]) => (
                  <div
                    key={factor}
                    className="rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold capitalize">
                        {factor.replace("_", " ")}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {detail.score.toFixed(1)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">{detail.description}</p>
                    <p className="text-[0.7rem] text-slate-400">
                      Weight: {(detail.weight * 100).toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onCreateReport}
          disabled={!isLoggedIn}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {isLoggedIn ? "Create report" : "Login to create report"}
        </button>
        {!isLoggedIn && (
          <p className="text-center text-xs text-slate-500">
            Sign in to add observations for this community.
          </p>
        )}
      </div>
    </div>
  );
};

export default CommunityStatsPanel;
