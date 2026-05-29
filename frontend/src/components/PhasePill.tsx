import { Phase } from "../types";

const PHASE_COLORS: Record<string, string> = {
  "Setup": "bg-slate-500/15 text-slate-200 border-slate-400/30",
  "Seed Keywords": "bg-purple-500/15 text-purple-200 border-purple-400/40",
  "Keyword Score": "bg-indigo-500/15 text-indigo-200 border-indigo-400/40",
  "Broad Matches": "bg-cyan-500/15 text-cyan-200 border-cyan-400/40",
  "SERP & Clustering": "bg-teal-500/15 text-teal-200 border-teal-400/40",
  "Page Type": "bg-amber-500/15 text-amber-200 border-amber-400/40",
  "Topical Map": "bg-orange-500/15 text-orange-200 border-orange-400/40",
  "Cleanup": "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
  "Unknown": "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

interface Props {
  phase: Phase | null;
  onClick?: () => void;
}

export default function PhasePill({ phase, onClick }: Props) {
  if (!phase) return <span className="text-slate-500 text-xs">—</span>;
  const cls = PHASE_COLORS[phase.name] ?? PHASE_COLORS["Unknown"];
  const interactive = onClick
    ? "cursor-pointer hover:scale-[1.05] hover:shadow-[0_0_18px_-4px_currentColor]"
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
      className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-medium tracking-wide backdrop-blur-sm transition-all ${cls} ${interactive}`}
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
