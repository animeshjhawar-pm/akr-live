import { useEffect, useState } from "react";

interface PhaseDetail {
  name: string;
  states: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const PHASE_COLORS: Record<string, string> = {
  "Setup": "bg-slate-500/15 text-slate-200 border-slate-400/30",
  "Seed Keywords": "bg-purple-500/15 text-purple-200 border-purple-400/40",
  "Keyword Score": "bg-indigo-500/15 text-indigo-200 border-indigo-400/40",
  "Broad Matches": "bg-cyan-500/15 text-cyan-200 border-cyan-400/40",
  "SERP & Clustering": "bg-teal-500/15 text-teal-200 border-teal-400/40",
  "Page Type": "bg-amber-500/15 text-amber-200 border-amber-400/40",
  "Topical Map": "bg-orange-500/15 text-orange-200 border-orange-400/40",
  "Cleanup": "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
};

export default function PhasesDrawer({ open, onClose }: Props) {
  const [phases, setPhases] = useState<PhaseDetail[]>([]);

  useEffect(() => {
    if (!open || phases.length > 0) return;
    fetch("/api/phases")
      .then((r) => r.json())
      .then((d) => setPhases(d.phases ?? []));
  }, [open, phases.length]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity z-40 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-96 max-w-[100vw] glass-strong border-l border-cyan-400/20 shadow-[0_0_60px_-10px_rgba(34,211,238,0.4)] z-50 transform transition-transform overflow-y-auto text-slate-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 backdrop-blur-xl bg-slate-950/60">
          <h2 className="text-lg font-semibold holo-text">AKR Pipeline Phases</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-cyan-300 text-2xl leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          {phases.map((p, i) => (
            <div key={p.name}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-slate-500 w-5 font-mono">{i + 1}.</span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full border text-sm font-medium backdrop-blur-sm ${
                    PHASE_COLORS[p.name] ?? "bg-slate-500/10 border-slate-400/20 text-slate-300"
                  }`}
                >
                  {p.name}
                </span>
              </div>
              <ul className="ml-7 text-xs text-slate-400 font-mono space-y-0.5">
                {p.states.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
