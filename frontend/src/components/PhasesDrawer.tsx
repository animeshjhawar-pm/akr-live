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
  "Setup": "bg-slate-100 text-slate-700",
  "Seed Keywords": "bg-purple-100 text-purple-800",
  "Keyword Score": "bg-indigo-100 text-indigo-800",
  "Broad Matches": "bg-cyan-100 text-cyan-800",
  "SERP & Clustering": "bg-teal-100 text-teal-800",
  "Page Type": "bg-amber-100 text-amber-800",
  "Topical Map": "bg-orange-100 text-orange-800",
  "Cleanup": "bg-green-100 text-green-800",
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
        className={`fixed inset-0 bg-black/30 transition-opacity z-40 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform overflow-y-auto ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">AKR Pipeline Phases</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          {phases.map((p, i) => (
            <div key={p.name}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 w-5">{i + 1}.</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${
                    PHASE_COLORS[p.name] ?? "bg-slate-100"
                  }`}
                >
                  {p.name}
                </span>
              </div>
              <ul className="ml-7 text-xs text-slate-600 font-mono space-y-0.5">
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
