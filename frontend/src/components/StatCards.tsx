interface Props {
  running: number;
  failed: number;
  succeeded: number;
  uniqueFailedProjects: number;
}

export default function StatCards(p: Props) {
  const cards = [
    { label: "Running", value: p.running, color: "text-blue-600" },
    { label: "Succeeded in window", value: p.succeeded, color: "text-green-600" },
    { label: "Failed in window", value: p.failed, color: "text-red-600" },
    { label: "Unique failed projects", value: p.uniqueFailedProjects, color: "text-red-500" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded p-3 shadow-sm">
          <div className="text-xs text-slate-500">{c.label}</div>
          <div className={`text-2xl font-semibold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
