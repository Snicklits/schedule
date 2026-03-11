import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { useCompany } from "../contexts/CompanyContext.js";

const LINKS = [
  { to: "/portal/schedule", label: "My Schedule" },
  { to: "/portal/time-off", label: "Time Off" },
  { to: "/portal/hours", label: "Hours" },
  { to: "/portal/swaps", label: "Swap Requests" },
];

export function PortalNavBar() {
  const { logout } = useAuth();
  const { config } = useCompany();
  const companyName = config?.company_name ?? "Employee Portal";

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
      <button
        onClick={logout}
        className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors"
      >
        Sign out
      </button>
    </nav>
  );
}
