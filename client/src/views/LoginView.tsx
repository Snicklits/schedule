import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.js";

type Mode = "manager" | "employee";

export function LoginView() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("manager");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "manager" && (!username.trim() || !password.trim())) {
      setError("Please enter username and password");
      return;
    }
    if (mode === "employee" && !employeeId.trim()) {
      setError("Please enter your Employee ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "manager") {
        await login("dev-admin", "ADMIN");
      } else {
        await login(employeeId.trim(), "STAFF");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all";

  return (
    <div className="min-h-screen bg-[#eef0f8] flex items-center justify-center p-4">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-violet-200/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">ScheduleMgr</h1>
              <p className="text-sm text-slate-400 mt-0.5">Sign in to your workspace</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden p-0.5 bg-slate-50 gap-0.5">
            {(["manager", "employee"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-150 ${
                  mode === m
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "manager" ? "Manager" : "Employee"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "manager" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputCls}
                    placeholder="admin"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Employee ID</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. clm4x2abc..."
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Your Employee ID is provided by your manager.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm mt-1"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          ScheduleMgr · Workforce Scheduling Platform
        </p>
      </div>
    </div>
  );
}
