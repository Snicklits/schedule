/**
 * PortalSidebar — fixed 220px left sidebar for the employee portal.
 *
 * Phase 9 additions:
 *   - Loads company branding (name + logo) on mount
 *   - Avatar upload (click to open file picker, crop/preview, POST base64)
 *   - My Pay nav link
 */

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { useState, useEffect, useRef } from "react";
import { fetchCompanyConfig, uploadAvatar } from "../api/endpoints.js";
import type { CompanyConfig } from "../api/types.js";

function Icon({ path, className = "w-4 h-4" }: { path: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  grid:     "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  clock:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  chart:    "M18 20V10M12 20V4M6 20v-6",
  refresh:  "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15",
  logout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  cash:     "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  camera:   "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
};

interface NavItemProps {
  to: string;
  iconPath: string;
  label: string;
}

function NavItem({ to, iconPath, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group ${
          isActive
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`flex-shrink-0 transition-colors ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`}>
            <Icon path={iconPath} className="w-4 h-4" />
          </span>
          <span className="flex-1">{label}</span>
          {isActive && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
        </>
      )}
    </NavLink>
  );
}

export function PortalSidebar() {
  const { logout, employeeId } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCompanyConfig().then(setCompany).catch(() => {});
  }, []);

  const initials = employeeId ? employeeId.slice(0, 2).toUpperCase() : "ME";
  const companyName = company?.company_name ?? "ScheduleMgr";
  const logoUrl = company?.logo_url;

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const mime_type = file.type || "image/jpeg";
        const result = await uploadAvatar(base64, mime_type);
        setAvatarUrl(result.avatar_url);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
    e.target.value = "";
  }

  return (
    <aside className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto">
      {/* ── Brand ── */}
      <div className="px-4 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Icon path={ICONS.grid} className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="leading-tight min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{companyName}</p>
            <p className="text-[10px] text-slate-400">Employee Portal</p>
          </div>
        </div>
      </div>

      {/* ── Avatar block ── */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleAvatarClick}
            disabled={uploading}
            title="Click to change photo"
            className="relative group cursor-pointer"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-14 h-14 rounded-full object-cover shadow-sm" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg select-none shadow-sm">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Icon path={ICONS.camera} className="w-5 h-5 text-white" />
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <span className="text-white text-[10px] font-semibold">…</span>
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="text-center">
            <p className="text-xs text-slate-400 font-mono truncate max-w-[140px]">{employeeId || "Employee"}</p>
            <p className="text-xs text-slate-500 mt-0.5">Team Member</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-2">
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">My Portal</p>
        <div className="space-y-0.5">
          <NavItem to="/portal/schedule" iconPath={ICONS.calendar} label="My Schedule" />
          <NavItem to="/portal/time-off" iconPath={ICONS.clock}    label="Time Off" />
          <NavItem to="/portal/hours"    iconPath={ICONS.chart}     label="My Hours" />
          <NavItem to="/portal/swaps"    iconPath={ICONS.refresh}   label="Shift Swaps" />
          <NavItem to="/portal/pay"      iconPath={ICONS.cash}      label="My Pay" />
        </div>
      </nav>

      {/* ── Bottom ── */}
      <div className="px-3 py-3 border-t border-slate-100">
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <Icon path={ICONS.logout} className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
