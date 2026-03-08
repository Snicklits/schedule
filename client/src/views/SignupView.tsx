/**
 * SignupView — activate account via invite token
 *
 * Reads ?token= from URL, lets employee set a password.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signupWithToken } from "../api/endpoints.js";
import { storeToken } from "../auth.js";
import { useAuth } from "../contexts/AuthContext.js";
import { fetchCompanyConfig } from "../api/endpoints.js";
import type { CompanyConfig } from "../api/types.js";

export function SignupView() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [company, setCompany] = useState<CompanyConfig | null>(null);

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  useEffect(() => {
    fetchCompanyConfig().then(setCompany).catch(() => {});
    logout(); // clear any existing session
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid invite link. Please request a new invite from your manager.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await signupWithToken(token, password);
      storeToken(result.token);
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message;
      setError(msg ?? "Failed to activate account. The invite may have expired.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all";

  const companyName = company?.company_name ?? "ScheduleMgr";

  return (
    <div className="min-h-screen bg-[#eef0f8] flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-violet-200/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{companyName}</h1>
              <p className="text-sm text-slate-400 mt-0.5">Set up your account</p>
            </div>
          </div>

          {success ? (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-2xl">✓</div>
              <p className="text-sm font-semibold text-emerald-700">Account activated!</p>
              <p className="text-xs text-slate-400">Redirecting you to the app…</p>
            </div>
          ) : (
            <>
              {!token && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-700">
                    No invite token found. Please use the link from your invite email.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputCls}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm mt-1"
                >
                  {loading ? "Activating…" : "Activate Account"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
