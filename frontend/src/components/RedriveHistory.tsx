import { useEffect, useState } from "react";
import { formatIST } from "../util";

interface RedriveEvent {
  timestamp: string | null;
  redriveCount: number | null;
}

interface Props {
  executionArn: string;
  redriveCount: number;
}

export default function RedriveHistory({ executionArn, redriveCount }: Props) {
  const [events, setEvents] = useState<RedriveEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (redriveCount <= 0) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/executions/redrives?arn=${encodeURIComponent(executionArn)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setEvents(d.redrives ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [executionArn, redriveCount]);

  if (redriveCount <= 0) return null;

  return (
    <div>
      <div className="text-xs uppercase text-slate-500 mb-1">
        Redrive history ({redriveCount})
      </div>
      {loading && <div className="text-xs text-slate-500">Loading…</div>}
      {error && <div className="text-xs text-red-600">{error}</div>}
      {events && events.length === 0 && (
        <div className="text-xs text-slate-500">No redrive events found in history.</div>
      )}
      {events && events.length > 0 && (
        <ol className="text-xs space-y-1">
          {events.map((e, i) => (
            <li key={i} className="font-mono">
              <span className="inline-block w-10 text-slate-500">#{e.redriveCount ?? i + 1}</span>
              <span>{e.timestamp ? formatIST(e.timestamp) : "—"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
