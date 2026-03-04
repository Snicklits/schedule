/**
 * Employee Repository
 *
 * All database access for the Employee model.  Returns engine-layer Employee
 * objects; never exposes Prisma model shapes to callers.
 */

import type { Employee } from "../constraintEngine/types.js";
import { ManagementTier } from "../constraintEngine/types.js";
import { prisma } from "../lib/prisma.js";
import { toEmployee } from "./mappers.js";

/** Returns all employees with status ACTIVE. */
export async function getAllActiveEmployees(): Promise<Employee[]> {
  const rows = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { hierarchy_rank: "asc" },
  });
  return rows.map(toEmployee);
}

/** Returns a single employee by ID, or null if not found. */
export async function getEmployeeById(id: string): Promise<Employee | null> {
  const row = await prisma.employee.findUnique({ where: { id } });
  return row ? toEmployee(row) : null;
}

/** Returns all ACTIVE employees in the given management tier. */
export async function getEmployeesByTier(
  tier: (typeof ManagementTier)[keyof typeof ManagementTier]
): Promise<Employee[]> {
  const rows = await prisma.employee.findMany({
    where: { management_tier: tier, status: "ACTIVE" },
    orderBy: [{ hierarchy_rank: "asc" }],
  });
  return rows.map(toEmployee);
}

/** Creates a new employee and returns the engine-layer representation. */
export async function createEmployee(
  data: Omit<Employee, "id"> & {
    email: string;
    hire_date: Date;
    role: string;
  }
): Promise<Employee> {
  const row = await prisma.employee.create({
    data: {
      name: data.name,
      email: data.email,
      employment_type: data.employment_type,
      weekly_hours_target: data.weekly_hours_target,
      hire_date: data.hire_date,
      seniority_level: data.seniority_level,
      role: data.role,
      hierarchy_rank: data.hierarchy_rank,
      management_tier: data.management_tier,
      specialties: data.specialties,
      status: "ACTIVE",
    },
  });
  return toEmployee(row);
}

/** Returns all employees (including INACTIVE) with full fields for the manager UI. */
export async function getAllEmployeesWithStatus() {
  const rows = await prisma.employee.findMany({
    orderBy: [{ management_tier: "asc" }, { hierarchy_rank: "asc" }],
  });
  return rows.map((r) => ({
    ...toEmployee(r),
    status: r.status as "ACTIVE" | "INACTIVE",
    email: r.email,
    hire_date: r.hire_date,
    role: r.role,
  }));
}

/** Updates an existing employee's mutable fields. */
export async function updateEmployee(
  id: string,
  updates: Partial<
    Pick<
      Employee,
      | "name"
      | "specialties"
      | "seniority_level"
      | "weekly_hours_target"
      | "management_tier"
      | "employment_type"
    > & { role?: string; status?: "ACTIVE" | "INACTIVE" }
  >
): Promise<Employee> {
  const row = await prisma.employee.update({
    where: { id },
    data: updates,
  });
  return toEmployee(row);
}
