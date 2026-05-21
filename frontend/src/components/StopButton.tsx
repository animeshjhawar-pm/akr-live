import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  executionArn: string;
  executionName: string;
  onSuccess: () => void;
  compact?: boolean;
}

export default function StopButton({ executionArn, executionName, onSuccess, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doStop() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await fetch(
        `/api/executions/stop?arn=${encodeURIComponent(executionArn)}`,
        { method: "POST" }
      );
      const d = await r.json();
      if (d.ok) {
        setMsg("Stopped ✓");
        onSuccess();
      } else {
        setError(d.error ?? "Stop failed");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
        disabled={busy}
        className={`inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded font-medium shadow-sm ${
          compact ? "text-xs px-2.5 py-1" : "text-xs px-3 py-1.5"
        }`}
      >
        <span className="inline-block w-2.5 h-2.5 bg-white rounded-[2px]" />
        {busy ? "Stopping…" : "Stop"}
      </button>
      {msg && <span className="text-xs text-green-700">{msg}</span>}
      {error && (
        <span className="text-xs text-red-700" title={error}>
          {error.slice(0, 80)}
        </span>
      )}

      <ConfirmDialog
        open={confirming}
        title="Stop execution?"
        message={`${executionName}\n\nThis aborts the run in AWS immediately and cannot be undone.`}
        confirmLabel="Stop execution"
        tone="danger"
        busy={busy}
        onConfirm={doStop}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
