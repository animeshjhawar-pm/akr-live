import { FailedExecution } from "../types";
import { formatIST, formatDuration, truncate } from "../util";
import { SortableTable, Column } from "./SortableTable";
import PhasePill from "./PhasePill";
import RedriveHistory from "./RedriveHistory";
import RedriveButton from "./RedriveButton";

interface Props {
  rows: FailedExecution[];
  onPhaseClick?: () => void;
  onRedriven: () => void;
}

export default function FailedTable({ rows, onPhaseClick, onRedriven }: Props) {
  const cols: Column<FailedExecution>[] = [
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
      render: (r) => <span>{formatIST(r.startDate)}</span>,
    },
    {
      key: "dur",
      label: "Duration",
      sortVal: (r) => (r.stopEpoch ?? 0) - r.startEpoch,
      render: (r) =>
        r.stopEpoch ? formatDuration(Math.floor(r.stopEpoch - r.startEpoch)) : "—",
    },
    {
      key: "phase",
      label: "Phase",
      sortVal: (r) => r.phase?.index ?? -1,
      render: (r) => <PhasePill phase={r.phase} onClick={onPhaseClick} />,
    },
    {
      key: "step",
      label: "Failed at step",
      sortVal: (r) => r.failedStep ?? "",
      render: (r) => (
        <div>
          <div>
            {r.failedStep ?? "—"}
            {r.mapIteration != null && (
              <span className="text-xs text-slate-500"> (iter {r.mapIteration})</span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Step {r.stepIndex ?? "?"} of {r.totalSteps ?? "?"}
          </div>
        </div>
      ),
    },
    {
      key: "err",
      label: "Error",
      sortVal: (r) => r.errorType ?? "",
      render: (r) => (
        <div title={r.errorMessage ?? ""}>
          <div className="font-medium text-red-700">{r.errorType ?? r.status}</div>
          <div className="text-xs text-slate-600">{truncate(r.errorMessage, 200)}</div>
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
      rowAccent="border-l-4 border-l-red-500"
      expanded={(r) => (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={r.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              Open in AWS Console ↗
            </a>
            <span className="text-slate-500">Redrives: {r.redriveCount}</span>
            <span className="text-slate-500">Status: {r.status}</span>
            <RedriveButton
              executionArn={r.executionArn}
              executionName={r.executionName}
              onSuccess={onRedriven}
            />
          </div>
          <RedriveHistory executionArn={r.executionArn} redriveCount={r.redriveCount} />
          {r.errorMessage && (
            <div>
              <div className="text-xs uppercase text-slate-500 mb-1">Error message</div>
              <pre className="bg-red-50 border border-red-200 p-2 rounded text-xs overflow-auto max-h-80 whitespace-pre-wrap">
                {r.errorMessage}
              </pre>
            </div>
          )}
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
