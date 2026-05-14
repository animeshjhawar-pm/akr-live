import { SucceededExecution } from "../types";
import { formatIST, formatDuration } from "../util";
import { SortableTable, Column } from "./SortableTable";
import RedriveHistory from "./RedriveHistory";

interface Props {
  rows: SucceededExecution[];
}

export default function SucceededTable({ rows }: Props) {
  const cols: Column<SucceededExecution>[] = [
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
      key: "stop",
      label: "Completed",
      sortVal: (r) => r.stopEpoch ?? 0,
      render: (r) => <span>{r.stopDate ? formatIST(r.stopDate) : "—"}</span>,
    },
    {
      key: "dur",
      label: "Duration",
      sortVal: (r) => (r.stopEpoch ?? 0) - r.startEpoch,
      render: (r) =>
        r.stopEpoch ? formatDuration(Math.floor(r.stopEpoch - r.startEpoch)) : "—",
    },
    {
      key: "steps",
      label: "Steps run",
      sortVal: (r) => r.stepIndex ?? 0,
      render: (r) => (
        <span>
          {r.stepIndex ?? "?"} of {r.totalSteps ?? "?"}
        </span>
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
      rowAccent="border-l-4 border-l-green-500"
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
