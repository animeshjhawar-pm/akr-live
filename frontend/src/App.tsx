import { useCallback, useEffect, useMemo, useState } from "react";
import Controls from "./components/Controls";
import StatCards from "./components/StatCards";
import RunningTable from "./components/RunningTable";
import FailedTable from "./components/FailedTable";
import SucceededTable from "./components/SucceededTable";
import PhasesDrawer from "./components/PhasesDrawer";
import {
  FailedExecution,
  RunningExecution,
  StateMachine,
  SucceededExecution,
} from "./types";
import { loadLS, saveLS } from "./util";

const LS_HOURS = "akr.hours";
const LS_TAB = "akr.tab";

const LOGO_URL = "https://cdn.gushwork.ai/v2/gush_new_logo.svg";

type Tab = "running" | "failed" | "succeeded";

export default function App() {
  const [stateMachines, setStateMachines] = useState<StateMachine[]>([]);
  const [hours, setHours] = useState<number>(() => loadLS<number>(LS_HOURS, 168));
  const [tab, setTab] = useState<Tab>(() => loadLS<Tab>(LS_TAB, "running"));

  const [running, setRunning] = useState<RunningExecution[]>([]);
  const [failed, setFailed] = useState<FailedExecution[]>([]);
  const [succeeded, setSucceeded] = useState<SucceededExecution[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [phasesOpen, setPhasesOpen] = useState(false);

  useEffect(() => saveLS(LS_HOURS, hours), [hours]);
  useEffect(() => saveLS(LS_TAB, tab), [tab]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/state-machines")
      .then((r) => r.json())
      .then((d) => setStateMachines(d.stateMachines))
      .catch((e) => setError(String(e)));
  }, []);

  const fetchData = useCallback(async () => {
    if (stateMachines.length === 0) return;
    setRefreshing(true);
    setError(null);
    try {
      const [runResp, failResp, sucResp] = await Promise.all([
        fetch(`/api/executions/running`).then((r) => r.json()),
        fetch(`/api/executions/failed?hours=${hours}`).then((r) => r.json()),
        fetch(`/api/executions/succeeded?hours=${hours}`).then((r) => r.json()),
      ]);
      setRunning(runResp.executions ?? []);
      setFailed(failResp.executions ?? []);
      setSucceeded(sucResp.executions ?? []);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [hours, stateMachines.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const uniqueFailedProjects = useMemo(
    () => new Set(failed.map((f) => f.projectId).filter(Boolean)).size,
    [failed]
  );

  const smConsoleUrl = stateMachines[0]?.consoleUrl ?? null;

  return (
    <div className="min-h-screen relative">
      <div className="fx-bg" aria-hidden />
      <div className="max-w-[1400px] mx-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
        <div className="rounded-2xl overflow-hidden glass">
          <header className="sweep relative flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-indigo-600/40 via-violet-600/30 to-fuchsia-600/40 border-b border-white/10">
            <div className="flex items-center gap-3 sm:gap-4 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 blur-md opacity-70" />
                <img
                  src={LOGO_URL}
                  alt="Gushwork"
                  className="relative h-8 sm:h-10 w-auto bg-white/95 rounded-xl p-1 ring-1 ring-white/40"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold leading-tight tracking-tight holo-text">
                  AKR Dashboard
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-300/80 tracking-wide">
                  Automated Keyword Research · Step Functions monitor
                </p>
              </div>
            </div>
            <button
              onClick={() => setPhasesOpen(true)}
              className="relative z-10 text-xs sm:text-sm bg-white/10 hover:bg-white/20 text-white border border-white/25 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl backdrop-blur-md transition-all hover:scale-[1.03] hover:glow-violet"
            >
              <span className="inline-block mr-1.5">◇</span>View phases
            </button>
          </header>

          <Controls
            hours={hours}
            setHours={setHours}
            onRefresh={fetchData}
            lastRefreshed={lastRefreshed}
            refreshing={refreshing}
            stateMachineConsoleUrl={smConsoleUrl}
          />
        </div>

        <PhasesDrawer open={phasesOpen} onClose={() => setPhasesOpen(false)} />

      {error && (
        <div className="glass rounded-xl border border-rose-500/40 text-rose-200 p-3 text-sm glow-pink">
          {error}
        </div>
      )}

      <StatCards
        running={running.length}
        failed={failed.length}
        succeeded={succeeded.length}
        uniqueFailedProjects={uniqueFailedProjects}
      />

      <div className="flex gap-1 sm:gap-2 overflow-x-auto p-1 rounded-2xl glass">
        <TabButton tab="running" current={tab} onClick={setTab} color="cyan" count={running.length}>
          Running
        </TabButton>
        <TabButton tab="failed" current={tab} onClick={setTab} color="pink" count={failed.length}>
          Failed
        </TabButton>
        <TabButton
          tab="succeeded"
          current={tab}
          onClick={setTab}
          color="emerald"
          count={succeeded.length}
        >
          Succeeded
        </TabButton>
      </div>

      {tab === "running" && (
        <RunningTable
          rows={running}
          now={now}
          onPhaseClick={() => setPhasesOpen(true)}
          onStopped={fetchData}
        />
      )}
      {tab === "failed" && (
        <FailedTable
          rows={failed}
          onPhaseClick={() => setPhasesOpen(true)}
          onRedriven={fetchData}
        />
      )}
      {tab === "succeeded" && <SucceededTable rows={succeeded} />}
      </div>
    </div>
  );
}

function TabButton({
  tab,
  current,
  onClick,
  color,
  count,
  children,
}: {
  tab: Tab;
  current: Tab;
  onClick: (t: Tab) => void;
  color: "cyan" | "pink" | "emerald";
  count: number;
  children: React.ReactNode;
}) {
  const active = tab === current;
  const activeBg = {
    cyan: "bg-gradient-to-r from-cyan-500/30 to-blue-500/20 text-cyan-100 glow-cyan",
    pink: "bg-gradient-to-r from-fuchsia-500/30 to-rose-500/20 text-pink-100 glow-pink",
    emerald: "bg-gradient-to-r from-emerald-500/30 to-teal-500/20 text-emerald-100 glow-emerald",
  }[color];
  return (
    <button
      onClick={() => onClick(tab)}
      className={`relative px-4 sm:px-5 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
        active
          ? `${activeBg} border border-white/15`
          : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
      }`}
    >
      {children}
      <span
        className={`ml-2 inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
          active ? "bg-white/15 text-white" : "bg-white/5 text-slate-300"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
