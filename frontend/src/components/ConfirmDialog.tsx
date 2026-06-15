import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "warning";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  // Lock body scroll while open and dismiss on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmCls =
    tone === "danger"
      ? "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 shadow-[0_0_24px_-4px_rgba(244,63,94,0.7)]"
      : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_24px_-4px_rgba(245,158,11,0.7)]";

  const glow = tone === "danger" ? "shadow-[0_0_80px_-10px_rgba(244,63,94,0.5)]" : "shadow-[0_0_80px_-10px_rgba(245,158,11,0.5)]";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onCancel();
      }}
    >
      <div
        className={`glass-strong rounded-2xl w-full max-w-sm overflow-hidden text-slate-200 ${glow}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm text-slate-300 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 bg-white/[0.03] border-t border-white/10">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-60 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-3 py-1.5 text-sm rounded-lg text-white disabled:opacity-60 transition hover:scale-[1.03] ${confirmCls}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
