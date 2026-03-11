import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { fetchInviteInfo, signupUser } from "../api/endpoints.js";
import { storeToken } from "../auth.js";

import { useCompany } from "../contexts/CompanyContext.js";

export function SignupView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  
  const { config } = useCompany();
  const token = params.get("token") ?? "";
  const companyName = config?.company_name ?? "ScheduleMgr";

  const [inviteInfo, setInviteInfo] = useState<{ email: string; name: string } | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setInfoError("No invite token found. Please check your invitation link."); setLoadingInfo(false); return; }
    fetchInviteInfo(token)
      .then((info) => setInviteInfo(info))
      .catch(() => setInfoError("This invite link is invalid or has expired."))
      .finally(() => setLoadingInfo(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const data = await signupUser(token, password, confirmPassword);
      storeToken(data.token);
      // Navigate to correct portal
      const isStaff = data.role === "STAFF";
      navigate(isStaff ? "/portal/schedule" : "/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? "Failed to set up account";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInfo) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Checking invite…</p></div>;
  }

  if (infoError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-sm w-full text-center space-y-4">
          <p className="text-red-600">{infoError}</p>
          <a href="/" className="text-indigo-600 hover:underline text-sm">Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Set up your account</h1>
          <p className="text-sm text-gray-500 mt-1">{companyName}</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={inviteInfo?.name ?? ""} readOnly className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={inviteInfo?.email ?? ""} readOnly className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min. 8 characters"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Repeat password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded text-sm transition-colors"
          >
            {submitting ? "Setting up…" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
