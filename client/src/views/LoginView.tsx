import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import { fetchCompanyConfig } from "../api/endpoints.js";
import type { CompanyConfig } from "../api/types.js";

export function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyConfig | null>(null);

  useEffect(() => {
    fetchCompanyConfig().then(setCompany).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password.trim());
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message;
      setError(msg ?? "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all";

  const companyName = company?.company_name ?? "ScheduleMgr";
  const logoUrl = company?.logo_url;

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
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="w-12 h-12 rounded-2xl object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
                </svg>
              </div>
            )}
            <div className="text-center">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{companyName}</h1>
              <p className="text-sm text-slate-400 mt-0.5">Sign in to your workspace</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@company.com"
                autoComplete="email"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm mt-1"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">
            New employee?{" "}
            <a href="/signup" className="text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
              Set up your account
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          {companyName} · Workforce Scheduling Platform
        </p>
      </div>
    </div>
  );
}
