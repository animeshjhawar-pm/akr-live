import { Phase } from "../types";

const PHASE_COLORS: Record<string, string> = {
  "Setup": "bg-slate-100 text-slate-700 border-slate-200",
  "Seed Keywords": "bg-purple-100 text-purple-800 border-purple-200",
  "Keyword Score": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Broad Matches": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "SERP & Clustering": "bg-teal-100 text-teal-800 border-teal-200",
  "Page Type": "bg-amber-100 text-amber-800 border-amber-200",
  "Topical Map": "bg-orange-100 text-orange-800 border-orange-200",
  "Cleanup": "bg-green-100 text-green-800 border-green-200",
  "Unknown": "bg-slate-100 text-slate-500 border-slate-200",
};

interface Props {
  phase: Phase | null;
  onClick?: () => void;
}

export default function PhasePill({ phase, onClick }: Props) {
  if (!phase) return <span className="text-slate-400 text-xs">—</span>;
  const cls = PHASE_COLORS[phase.name] ?? PHASE_COLORS["Unknown"];
  const interactive = onClick
    ? "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-300"
    : "";
  return (
    <span
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      title={onClick ? "Click to see all phases" : undefined}
      className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${cls} ${interactive}`}
    >
      {phase.name}
      {phase.index > 0 && (
        <span className="ml-1 opacity-70">
          ({phase.index}/{phase.total})
        </span>
      )}
    </span>
  );
}
