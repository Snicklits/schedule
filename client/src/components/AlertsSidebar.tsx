import { useEffect, useState } from "react";
import { useAlerts } from "../contexts/AlertsContext.js";
import { fetchViolations, fetchManagementGaps } from "../api/endpoints.js";

export function AlertsSidebar() {
  const { violations, gaps, setViolations, setGaps, triggerRefresh } = useAlerts();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchViolations(), fetchManagementGaps(currentMonday())])
      .then(([v, g]) => {
        setViolations(v);
        setGaps(g);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [triggerRefresh, setViolations, setGaps]);

  const totalCount = violations.length + gaps.length;

  return (
    <aside
      className={`border-l bg-gray-50 flex flex-col transition-all duration-200 shrink-0 ${
        collapsed ? "w-10" : "w-64"
      }`}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 border-b"
      >
        {collapsed ? "›" : "‹"}
        {!collapsed && (
          <span className="flex items-center gap-1">
            Alerts
            {totalCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {totalCount}
              </span>
            )}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {loading && <p className="text-gray-400">Loading…</p>}

          {gaps.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-600 mb-1">Management Gaps ({gaps.length})</h3>
              <ul className="space-y-1">
                {gaps.map((g) => (
                  <li key={g.shift_id} className="bg-red-50 border border-red-200 rounded p-2 text-red-700">
                    {new Date(g.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {g.is_peak_shift && " ★"}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {violations.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-600 mb-1">Violations ({violations.length})</h3>
              <ul className="space-y-1">
                {violations.map((v) => (
                  <li
                    key={v.id}
                    className={`rounded p-2 border text-xs ${
                      v.type === "BLOCKING"
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-yellow-50 border-yellow-200 text-yellow-700"
                    }`}
                  >
                    {v.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!loading && totalCount === 0 && (
            <p className="text-gray-400 italic">No alerts</p>
          )}
        </div>
      )}
    </aside>
  );
}

function currentMonday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
