import { useState, useEffect, useCallback } from "react";
import { fetchAllEmployees, createEmployee, updateEmployee } from "../api/endpoints.js";
import type { EmployeeWithStatus, ManagementTier } from "../api/types.js";
import { ErrorBanner } from "../components/ErrorBanner.js";
import { Modal } from "../components/Modal.js";
import { useToast } from "../contexts/ToastContext.js";

const TIERS: ManagementTier[] = ["MANAGER", "ASSISTANT_MANAGER", "STAFF"];

interface EmployeeForm {
  name: string;
  email: string;
  employment_type: "FULL_TIME" | "PART_TIME";
  weekly_hours_target: number;
  hire_date: string;
  seniority_level: number;
  role: string;
  hierarchy_rank: number;
  management_tier: ManagementTier;
  specialties: string;
  status: "ACTIVE" | "INACTIVE";
}

const emptyForm: EmployeeForm = {
  name: "",
  email: "",
  employment_type: "FULL_TIME",
  weekly_hours_target: 40,
  hire_date: "",
  seniority_level: 1,
  role: "",
  hierarchy_rank: 10,
  management_tier: "STAFF",
  specialties: "",
  status: "ACTIVE",
};

const TIER_STYLES: Record<ManagementTier, string> = {
  MANAGER:            "bg-violet-100 text-violet-700",
  ASSISTANT_MANAGER:  "bg-blue-100 text-blue-700",
  STAFF:              "bg-slate-100 text-slate-600",
};

export function EmployeeList() {
  const [employees, setEmployees] = useState<EmployeeWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [tierFilter, setTierFilter] = useState<ManagementTier | "">("");
  const [editTarget, setEditTarget] = useState<EmployeeWithStatus | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    fetchAllEmployees()
      .then(setEmployees)
      .catch(() => setError("Failed to load employees"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = employees.filter((e) => {
    if (filter !== "ALL" && e.status !== filter) return false;
    if (tierFilter && e.management_tier !== tierFilter) return false;
    return true;
  });

  function openEdit(emp: EmployeeWithStatus) {
    setEditTarget(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      employment_type: emp.employment_type,
      weekly_hours_target: emp.weekly_hours_target,
      hire_date: emp.hire_date?.slice(0, 10) ?? "",
      seniority_level: emp.seniority_level,
      role: emp.role,
      hierarchy_rank: emp.hierarchy_rank,
      management_tier: emp.management_tier,
      specialties: emp.specialties.join(", "),
      status: emp.status,
    });
  }

  function openAdd() {
    setForm(emptyForm);
    setShowAdd(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const specialties = form.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (editTarget) {
        await updateEmployee(editTarget.id, {
          name: form.name,
          employment_type: form.employment_type,
          weekly_hours_target: form.weekly_hours_target,
          seniority_level: form.seniority_level,
          role: form.role,
          management_tier: form.management_tier,
          specialties,
          status: form.status,
        });
        showToast("Employee updated", "success");
        setEditTarget(null);
      } else {
        await createEmployee({
          name: form.name,
          email: form.email,
          employment_type: form.employment_type,
          weekly_hours_target: form.weekly_hours_target,
          hire_date: form.hire_date,
          seniority_level: form.seniority_level,
          role: form.role,
          hierarchy_rank: form.hierarchy_rank,
          management_tier: form.management_tier,
          specialties,
        });
        showToast("Employee created", "success");
        setShowAdd(false);
      }
      load();
    } catch {
      setError("Failed to save employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Employees</h2>
          <p className="text-xs text-slate-400 mt-0.5">{employees.length} total · {employees.filter(e => e.status === "ACTIVE").length} active</p>
        </div>
        <button
          onClick={openAdd}
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-all duration-150 shadow-sm"
        >
          + Add Employee
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-xl border border-slate-200 overflow-hidden p-0.5 bg-slate-50 gap-0.5">
          {(["ACTIVE", "INACTIVE", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
                filter === s
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as ManagementTier | "")}
          className="h-8 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
        >
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tier</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hrs/wk</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    No employees found
                  </td>
                </tr>
              )}
              {visible.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{emp.role}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${TIER_STYLES[emp.management_tier]}`}>
                      {emp.management_tier.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{emp.employment_type.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 font-medium">{emp.weekly_hours_target}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      emp.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(emp)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors duration-150"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(editTarget || showAdd) && (
        <Modal
          title={editTarget ? `Edit: ${editTarget.name}` : "Add Employee"}
          onClose={() => { setEditTarget(null); setShowAdd(false); }}
          footer={
            <>
              <button
                onClick={() => { setEditTarget(null); setShowAdd(false); }}
                className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold transition-all duration-150 shadow-sm"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <Field label="Name">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            {!editTarget && (
              <Field label="Email">
                <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
            )}
            <Field label="Role">
              <input className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employment Type">
                <select className={inputCls} value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value as "FULL_TIME" | "PART_TIME" })}>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                </select>
              </Field>
              <Field label="Management Tier">
                <select className={inputCls} value={form.management_tier} onChange={(e) => setForm({ ...form, management_tier: e.target.value as ManagementTier })}>
                  {TIERS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Weekly Hours Target">
                <input type="number" className={inputCls} value={form.weekly_hours_target} onChange={(e) => setForm({ ...form, weekly_hours_target: Number(e.target.value) })} />
              </Field>
              <Field label="Seniority Level">
                <input type="number" className={inputCls} value={form.seniority_level} onChange={(e) => setForm({ ...form, seniority_level: Number(e.target.value) })} />
              </Field>
            </div>
            {!editTarget && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hire Date">
                  <input type="date" className={inputCls} value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
                </Field>
                <Field label="Hierarchy Rank">
                  <input type="number" className={inputCls} value={form.hierarchy_rank} onChange={(e) => setForm({ ...form, hierarchy_rank: Number(e.target.value) })} />
                </Field>
              </div>
            )}
            <Field label="Specialties (comma-separated)">
              <input className={inputCls} value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} placeholder="e.g. Espresso, Bar" />
            </Field>
            {editTarget && (
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

const inputCls = "w-full h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
