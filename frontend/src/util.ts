export function formatIST(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
}

export function relativeTime(epochSec: number, nowMs: number = Date.now()): string {
  const diff = Math.max(0, Math.floor(nowMs / 1000 - epochSec));
  return formatDuration(diff) + " ago";
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveLS<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
