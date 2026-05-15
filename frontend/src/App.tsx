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
    <div className="max-w-[1400px] mx-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <img src={LOGO_URL} alt="Gushwork" className="h-6 sm:h-8 w-auto" />
          <h1 className="text-lg sm:text-xl font-semibold">AKR Dashboard</h1>
        </div>
        <button
          onClick={() => setPhasesOpen(true)}
          className="text-xs sm:text-sm border border-slate-300 hover:bg-slate-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded"
        >
          View phases
        </button>
      </header>

      <PhasesDrawer open={phasesOpen} onClose={() => setPhasesOpen(false)} />

      <Controls
        hours={hours}
        setHours={setHours}
        onRefresh={fetchData}
        lastRefreshed={lastRefreshed}
        refreshing={refreshing}
        stateMachineConsoleUrl={smConsoleUrl}
      />

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 p-2 rounded text-sm">
          {error}
        </div>
      )}

      <StatCards
        running={running.length}
        failed={failed.length}
        succeeded={succeeded.length}
        uniqueFailedProjects={uniqueFailedProjects}
      />

      <div className="flex gap-1 sm:gap-2 border-b border-slate-200 overflow-x-auto">
        <TabButton tab="running" current={tab} onClick={setTab} color="blue" count={running.length}>
          Running
        </TabButton>
        <TabButton tab="failed" current={tab} onClick={setTab} color="red" count={failed.length}>
          Failed
        </TabButton>
        <TabButton
          tab="succeeded"
          current={tab}
          onClick={setTab}
          color="green"
          count={succeeded.length}
        >
          Succeeded
        </TabButton>
      </div>

      {tab === "running" && (
        <RunningTable rows={running} now={now} onPhaseClick={() => setPhasesOpen(true)} />
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
  color: "blue" | "red" | "green";
  count: number;
  children: React.ReactNode;
}) {
  const active = tab === current;
  const colorMap = {
    blue: "border-blue-600 text-blue-700",
    red: "border-red-600 text-red-700",
    green: "border-green-600 text-green-700",
  };
  return (
    <button
      onClick={() => onClick(tab)}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        active ? `${colorMap[color]} font-medium` : "border-transparent text-slate-600"
      }`}
    >
      {children} ({count})
    </button>
  );
}
