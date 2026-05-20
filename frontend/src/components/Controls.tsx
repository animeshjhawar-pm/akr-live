interface Props {
  hours: number;
  setHours: (h: number) => void;
  onRefresh: () => void;
  lastRefreshed: Date | null;
  refreshing: boolean;
  stateMachineConsoleUrl: string | null;
}

const HOURS_OPTIONS = [
  { label: "1h", val: 1 },
  { label: "6h", val: 6 },
  { label: "24h", val: 24 },
  { label: "3d", val: 72 },
  { label: "7d", val: 168 },
  { label: "14d", val: 336 },
  { label: "30d", val: 720 },
];

export default function Controls(p: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 sm:gap-4 bg-gradient-to-b from-indigo-50 to-white border-t border-indigo-100 p-3 sm:p-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Time window</label>
        <select
          className="border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={p.hours}
          onChange={(e) => p.setHours(Number(e.target.value))}
        >
          {HOURS_OPTIONS.map((o) => (
            <option key={o.val} value={o.val}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={p.onRefresh}
        disabled={p.refreshing}
        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg text-sm shadow-sm transition-colors"
      >
        <span className={p.refreshing ? "animate-spin" : ""}>↻</span>
        {p.refreshing ? "Refreshing…" : "Refresh"}
      </button>

      <div className="w-full sm:w-auto sm:ml-auto text-xs sm:text-sm text-slate-600 flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              p.refreshing ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
            }`}
          />
          Last refreshed:{" "}
          <strong>
            {p.lastRefreshed
              ? p.lastRefreshed.toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour12: false,
                })
              : "—"}
          </strong>
        </span>
        {p.stateMachineConsoleUrl && (
          <a
            href={p.stateMachineConsoleUrl}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline text-xs font-medium"
          >
            View state machine ↗
          </a>
        )}
      </div>
    </div>
  );
}
