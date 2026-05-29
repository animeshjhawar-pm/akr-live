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
    <div className="flex flex-wrap items-end gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-b from-white/[0.02] to-transparent">
      <div>
        <label className="block text-[10px] uppercase tracking-[0.15em] font-medium text-slate-400 mb-1.5">
          Time window
        </label>
        <select
          className="bg-slate-900/70 border border-white/10 text-slate-100 rounded-xl px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400/40 transition"
          value={p.hours}
          onChange={(e) => p.setHours(Number(e.target.value))}
        >
          {HOURS_OPTIONS.map((o) => (
            <option key={o.val} value={o.val} className="bg-slate-900">
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={p.onRefresh}
        disabled={p.refreshing}
        className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all hover:scale-[1.03] active:scale-95"
      >
        <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 opacity-90 group-hover:opacity-100" />
        <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 blur-md opacity-50 group-hover:opacity-80 transition" />
        <span className="relative inline-flex items-center gap-2">
          <span className={p.refreshing ? "animate-spin" : "transition-transform group-hover:rotate-180"}>↻</span>
          {p.refreshing ? "Refreshing…" : "Refresh"}
        </span>
      </button>

      <div className="w-full sm:w-auto sm:ml-auto text-xs sm:text-sm text-slate-300 flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-strong">
          <span className="relative inline-flex">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                p.refreshing ? "bg-amber-300" : "bg-emerald-400"
              } pulse-dot ${p.refreshing ? "text-amber-300" : "text-emerald-400"}`}
            />
          </span>
          <span className="text-slate-400">Last refreshed:</span>
          <strong className="text-slate-100 font-medium tabular-nums">
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
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-cyan-400/30 text-cyan-300 hover:text-cyan-200 hover:border-cyan-300/60 hover:glow-cyan text-xs font-medium transition"
          >
            View state machine ↗
          </a>
        )}
      </div>
    </div>
  );
}
