import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  executionArn: string;
  executionName: string;
  onSuccess: () => void;
  compact?: boolean;
}

export default function RedriveButton({ executionArn, executionName, onSuccess, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doRedrive() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await fetch(
        `/api/executions/redrive?arn=${encodeURIComponent(executionArn)}`,
        { method: "POST" }
      );
      const d = await r.json();
      if (d.ok) {
        setMsg("Redriven ✓");
        onSuccess();
      } else {
        setError(d.error ?? "Redrive failed");
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
        className={`inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded font-medium shadow-sm ${
          compact ? "text-xs px-2.5 py-1" : "text-xs px-3 py-1.5"
        }`}
      >
        <span>↻</span>
        {busy ? "Redriving…" : "Redrive"}
      </button>
      {msg && <span className="text-xs text-green-700">{msg}</span>}
      {error && (
        <span className="text-xs text-red-700" title={error}>
          {error.slice(0, 80)}
        </span>
      )}

      <ConfirmDialog
        open={confirming}
        title="Redrive execution?"
        message={`${executionName}\n\nThis will re-run the failed steps in AWS from where they stopped.`}
        confirmLabel="Redrive"
        tone="warning"
        busy={busy}
        onConfirm={doRedrive}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
