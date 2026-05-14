import { RunningExecution } from "../types";
import { formatIST, relativeTime, formatDuration } from "../util";
import { SortableTable, Column } from "./SortableTable";
import PhasePill from "./PhasePill";
import RedriveHistory from "./RedriveHistory";

interface Props {
  rows: RunningExecution[];
  now: number;
  onPhaseClick?: () => void;
}

export default function RunningTable({ rows, now, onPhaseClick }: Props) {
  const cols: Column<RunningExecution>[] = [
    {
      key: "project",
      label: "Project",
      sortVal: (r) => r.projectName ?? r.projectId ?? "",
      render: (r) => (
        <div>
          <div className="font-medium">{r.projectName ?? "(unknown)"}</div>
          <div className="text-xs text-slate-500">{r.projectId ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "start",
      label: "Triggered",
      sortVal: (r) => r.startEpoch,
      render: (r) => (
        <div>
          <div>{formatIST(r.startDate)}</div>
          <div className="text-xs text-slate-500">{relativeTime(r.startEpoch, now)}</div>
        </div>
      ),
    },
    {
      key: "elapsed",
      label: "Elapsed",
      sortVal: (r) => now / 1000 - r.startEpoch,
      render: (r) => <span>{formatDuration(Math.floor(now / 1000 - r.startEpoch))}</span>,
    },
    {
      key: "phase",
      label: "Phase",
      sortVal: (r) => r.phase?.index ?? -1,
      render: (r) => <PhasePill phase={r.phase} onClick={onPhaseClick} />,
    },
    {
      key: "step",
      label: "Current step",
      sortVal: (r) => r.currentStep?.name ?? "",
      render: (r) => (
        <div>
          <div>
            {r.currentStep?.name ?? "—"}
            {r.currentStep?.transitioning && (
              <span className="text-xs text-amber-700"> (transitioning)</span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Step {r.stepIndex ?? "?"} of {r.totalSteps ?? "?"}
          </div>
        </div>
      ),
    },
    {
      key: "pg",
      label: "Process group",
      sortVal: (r) => r.processGroupId ?? "",
      render: (r) => <span className="font-mono text-xs">{r.processGroupId ?? "—"}</span>,
    },
    {
      key: "redrive",
      label: "Redrives",
      sortVal: (r) => r.redriveCount,
      render: (r) => (
        <span title={r.redriveCount > 0 ? "Click row to see redrive times" : ""}>
          {r.redriveCount}
        </span>
      ),
    },
    {
      key: "exec",
      label: "Execution",
      sortVal: (r) => r.executionName,
      render: (r) => (
        <a
          href={r.consoleUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-600 hover:underline font-mono text-xs"
        >
          {r.executionName} ↗
        </a>
      ),
    },
  ];

  return (
    <SortableTable
      rows={rows}
      columns={cols}
      defaultSort="start"
      defaultDir="desc"
      rowKey={(r) => r.executionArn}
      rowAccent="border-l-4 border-l-blue-500"
      expanded={(r) => (
        <div className="space-y-2 text-sm">
          <div>
            <a
              href={r.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              Open in AWS Console ↗
            </a>
            <span className="text-slate-500 ml-3">Redrives: {r.redriveCount}</span>
          </div>
          <RedriveHistory executionArn={r.executionArn} redriveCount={r.redriveCount} />
          <details>
            <summary className="cursor-pointer text-slate-600">Input JSON</summary>
            <pre className="bg-slate-100 p-2 rounded text-xs overflow-auto max-h-80 mt-2">
              {tryFormat(r.input)}
            </pre>
          </details>
        </div>
      )}
    />
  );
}

function tryFormat(s: string | null): string {
  if (!s) return "";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
