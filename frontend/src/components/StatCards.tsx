interface Props {
  running: number;
  failed: number;
  succeeded: number;
  uniqueFailedProjects: number;
}

type Accent = "cyan" | "emerald" | "pink" | "violet";

const ACCENT: Record<Accent, { text: string; bar: string; glow: string; ring: string }> = {
  cyan: {
    text: "from-cyan-300 to-sky-400",
    bar: "from-cyan-400 to-blue-500",
    glow: "shadow-[0_0_40px_-10px_rgba(34,211,238,0.6)]",
    ring: "ring-cyan-400/30",
  },
  emerald: {
    text: "from-emerald-300 to-teal-400",
    bar: "from-emerald-400 to-teal-500",
    glow: "shadow-[0_0_40px_-10px_rgba(16,185,129,0.55)]",
    ring: "ring-emerald-400/30",
  },
  pink: {
    text: "from-pink-300 to-rose-400",
    bar: "from-fuchsia-500 to-rose-500",
    glow: "shadow-[0_0_40px_-10px_rgba(236,72,153,0.6)]",
    ring: "ring-pink-400/30",
  },
  violet: {
    text: "from-violet-300 to-fuchsia-400",
    bar: "from-violet-500 to-fuchsia-500",
    glow: "shadow-[0_0_40px_-10px_rgba(168,85,247,0.6)]",
    ring: "ring-violet-400/30",
  },
};

export default function StatCards(p: Props) {
  const cards: { label: string; value: number; accent: Accent; icon: string }[] = [
    { label: "Running", value: p.running, accent: "cyan", icon: "◉" },
    { label: "Succeeded in window", value: p.succeeded, accent: "emerald", icon: "✓" },
    { label: "Failed in window", value: p.failed, accent: "pink", icon: "✕" },
    { label: "Unique failed projects", value: p.uniqueFailedProjects, accent: "violet", icon: "◆" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 [perspective:1200px]">
      {cards.map((c) => {
        const a = ACCENT[c.accent];
        return (
          <div
            key={c.label}
            className={`tilt-3d relative glass rounded-2xl p-4 sm:p-5 overflow-hidden ring-1 ${a.ring} ${a.glow}`}
          >
            {/* glowing top bar */}
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${a.bar}`}
            />
            {/* corner orb */}
            <div
              className={`absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br ${a.bar} opacity-20 blur-2xl`}
            />
            <div className="flex items-start justify-between gap-2 relative">
              <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400 font-medium">
                {c.label}
              </div>
              <span className={`text-base bg-gradient-to-br ${a.text} bg-clip-text text-transparent`}>
                {c.icon}
              </span>
            </div>
            <div
              className={`mt-2 text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-br ${a.text} bg-clip-text text-transparent relative`}
            >
              {c.value}
            </div>
            {/* subtle scanline */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
        );
      })}
    </div>
  );
}
