import { useState, useEffect, useCallback } from "react";
import { fetchAllEmployees, createEmployee, updateEmployee, resendInvite } from "../api/endpoints.js";
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

  const tierBadge = (tier: ManagementTier) => {
    if (tier === "MANAGER") return "bg-purple-100 text-purple-700";
    if (tier === "ASSISTANT_MANAGER") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded"
        >
          + Add Employee
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-3 items-center text-sm">
        <label className="text-gray-600">Status:</label>
        {(["ACTIVE", "INACTIVE", "ALL"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full border text-xs font-medium ${
              filter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
        <label className="ml-4 text-gray-600">Tier:</label>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as ManagementTier | "")}
          className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Hours/wk</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Account</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    No employees found
                  </td>
                </tr>
              )}
              {visible.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{emp.name}</td>
                  <td className="px-4 py-2 text-gray-600">{emp.role}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${tierBadge(emp.management_tier)}`}>
                      {emp.management_tier.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{emp.employment_type.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{emp.weekly_hours_target}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      emp.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {(emp as EmployeeWithStatus & { account_status?: string }).account_status === "INVITED" && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Invited</span>
                    )}
                    {(emp as EmployeeWithStatus & { account_status?: string }).account_status === "ACTIVE" && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                    )}
                    {(emp as EmployeeWithStatus & { account_status?: string }).account_status === "SUSPENDED" && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Suspended</span>
                    )}
                    {!(emp as EmployeeWithStatus & { account_status?: string }).account_status && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right flex items-center gap-2 justify-end">
                    {(emp as EmployeeWithStatus & { account_status?: string }).account_status === "INVITED" && (
                      <button
                        onClick={async () => { try { await resendInvite(emp.id); showToast("Invite resent", "success"); } catch { /* ignore */ } }}
                        className="text-xs text-amber-600 hover:text-amber-800"
                      >
                        Resend Invite
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(emp)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editTarget || showAdd) && (
        <Modal
          title={editTarget ? `Edit: ${editTarget.name}` : "Add Employee"}
          onClose={() => { setEditTarget(null); setShowAdd(false); }}
          footer={
            <>
              <button
                onClick={() => { setEditTarget(null); setShowAdd(false); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm"
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

const inputCls = "w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
