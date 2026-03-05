import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const LINKS = [
  { to: "/portal/schedule", label: "My Schedule" },
  { to: "/portal/time-off", label: "Time Off" },
  { to: "/portal/hours", label: "Hours" },
  { to: "/portal/swaps", label: "Swap Requests" },
];

export function PortalNavBar() {
  const { logout } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-1">
        <span className="text-blue-600 font-bold text-lg mr-4">My Portal</span>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
