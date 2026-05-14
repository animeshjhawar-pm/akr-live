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
    <div className="flex flex-wrap items-end gap-4 bg-white p-4 rounded shadow-sm border border-slate-200">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Time window</label>
        <select
          className="border border-slate-300 rounded px-2 py-1 text-sm"
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
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-1.5 rounded text-sm"
      >
        {p.refreshing ? "Refreshing…" : "Refresh"}
      </button>

      <div className="ml-auto text-sm text-slate-600 flex items-center gap-3">
        <span>
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
            className="text-blue-600 hover:underline text-xs"
          >
            View state machine ↗
          </a>
        )}
      </div>
    </div>
  );
}
