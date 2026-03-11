import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { useCompany } from "../contexts/CompanyContext.js";
import { uploadAvatar } from "../api/endpoints.js";

const LINKS = [
  { to: "/portal/schedule", label: "My Schedule" },
  { to: "/portal/time-off", label: "Time Off" },
  { to: "/portal/hours", label: "Hours" },
  { to: "/portal/pay", label: "My Pay" },
  { to: "/portal/swaps", label: "Swap Requests" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PortalNavBar() {
  const { logout, employeeName, avatarUrl, setAvatarUrl } = useAuth();
  const { config } = useCompany();
  const companyName = config?.company_name ?? "Employee Portal";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          const res = await uploadAvatar(base64, file.type);
          setAvatarUrl(res.avatar_url);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-1">
        <span className="text-indigo-600 font-bold text-lg mr-4">{companyName}</span>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload profile photo"
          className="relative w-8 h-8 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-400 flex-shrink-0"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={employeeName} className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
              {initials(employeeName || "U")}
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs text-gray-500">…</span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { void handleAvatarChange(e); }}
        />
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
