import { Fragment, ReactNode, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortVal?: (row: T) => string | number;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  defaultSort: string;
  defaultDir?: "asc" | "desc";
  rowKey: (row: T) => string;
  expanded: (row: T) => ReactNode;
  rowAccent?: string;
}

export function SortableTable<T>(p: Props<T>) {
  const [sortKey, setSortKey] = useState(p.defaultSort);
  const [dir, setDir] = useState<"asc" | "desc">(p.defaultDir ?? "desc");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const sorted = [...p.rows].sort((a, b) => {
    const col = p.columns.find((c) => c.key === sortKey);
    if (!col || !col.sortVal) return 0;
    const va = col.sortVal(a);
    const vb = col.sortVal(b);
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });

  const toggle = (k: string) => setExpandedKey((cur) => (cur === k ? null : k));

  const actionCol = p.columns.find((c) => c.key === "actions");
  const projectCol = p.columns.find((c) => c.key === "project");
  const bodyCols = p.columns.filter((c) => c.key !== "actions" && c.key !== "project");

  return (
    <>
      {/* ---- Desktop: table ---- */}
      <div className="hidden sm:block overflow-x-auto bg-white border border-slate-200 rounded shadow-sm">
        <table className="w-full text-xs sm:text-sm min-w-[640px]">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              {p.columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => {
                    if (sortKey === c.key) setDir(dir === "asc" ? "desc" : "asc");
                    else {
                      setSortKey(c.key);
                      setDir("desc");
                    }
                  }}
                  className="text-left px-3 py-2 font-medium text-slate-700 cursor-pointer select-none whitespace-nowrap"
                >
                  {c.label}
                  {sortKey === c.key ? (dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={p.columns.length} className="p-6 text-center text-slate-400">
                  No executions
                </td>
              </tr>
            )}
            {sorted.map((row) => {
              const k = p.rowKey(row);
              const isOpen = expandedKey === k;
              return (
                <Fragment key={k}>
                  <tr
                    className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${
                      p.rowAccent ?? ""
                    }`}
                    onClick={() => toggle(k)}
                  >
                    {p.columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2 ${c.className ?? ""}`}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50 border-t border-slate-100">
                      <td colSpan={p.columns.length} className="p-4">
                        {p.expanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---- Mobile: cards ---- */}
      <div className="sm:hidden space-y-2">
        {sorted.length === 0 && (
          <div className="bg-white border border-slate-200 rounded shadow-sm p-6 text-center text-slate-400">
            No executions
          </div>
        )}
        {sorted.map((row) => {
          const k = p.rowKey(row);
          const isOpen = expandedKey === k;
          return (
            <div
              key={k}
              className={`bg-white border border-slate-200 rounded-lg shadow-sm ${
                p.rowAccent ?? ""
              }`}
            >
              <div className="p-3" onClick={() => toggle(k)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {projectCol ? projectCol.render(row) : null}
                  </div>
                  {actionCol && (
                    <div onClick={(e) => e.stopPropagation()}>{actionCol.render(row)}</div>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {bodyCols.map((c) => (
                    <div key={c.key} className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        {c.label}
                      </div>
                      <div className="text-xs">{c.render(row)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-indigo-600">
                  {isOpen ? "Tap to collapse ▲" : "Tap for details ▼"}
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50 p-3">
                  {p.expanded(row)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
