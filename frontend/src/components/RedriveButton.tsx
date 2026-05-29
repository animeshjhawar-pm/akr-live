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
        className={`inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-white rounded-lg font-medium shadow-[0_0_18px_-4px_rgba(245,158,11,0.7)] hover:shadow-[0_0_24px_-2px_rgba(245,158,11,0.9)] transition-all hover:scale-[1.04] ${
          compact ? "text-xs px-2.5 py-1" : "text-xs px-3 py-1.5"
        }`}
      >
        <span className={busy ? "animate-spin inline-block" : "inline-block"}>↻</span>
        {busy ? "Redriving…" : "Redrive"}
      </button>
      {msg && <span className="text-xs text-emerald-300">{msg}</span>}
      {error && (
        <span className="text-xs text-rose-300" title={error}>
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
