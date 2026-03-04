import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Schedule" },
  { to: "/generate", label: "Generate" },
  { to: "/employees", label: "Employees" },
  { to: "/time-off", label: "Time Off" },
  { to: "/hours", label: "Hours" },
];

export function NavBar() {
  return (
    <nav className="bg-gray-900 text-white px-4 py-3 flex items-center gap-6 shrink-0">
      <span className="font-bold text-lg tracking-tight mr-4">ScheduleMgr</span>
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${
              isActive ? "text-white underline underline-offset-4" : "text-gray-400 hover:text-white"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
