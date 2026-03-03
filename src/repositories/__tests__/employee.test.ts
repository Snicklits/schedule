/**
 * Employee repository tests — Prisma client is mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the Prisma singleton ─────────────────────────────────────────────────
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    employee: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma.js";
import {
  getAllActiveEmployees,
  getEmployeeById,
  getEmployeesByTier,
  createEmployee,
  updateEmployee,
} from "../employee.js";

const mockEmployee = {
  id: "emp-1",
  name: "Alice Hartman",
  employment_type: "FULL_TIME",
  weekly_hours_target: 40,
  management_tier: "MANAGER",
  specialties: ["cashier"],
  seniority_level: 8,
  hierarchy_rank: 1,
  // DB-only fields — mapper should strip these
  email: "alice@store.com",
  hire_date: new Date("2018-04-15"),
  role: "Manager",
  status: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAllActiveEmployees", () => {
  it("queries with status ACTIVE and returns mapped employees", async () => {
    (prisma.employee.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockEmployee]);
    const result = await getAllActiveEmployees();
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACTIVE" } })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("emp-1");
    expect((result[0] as Record<string, unknown>)["email"]).toBeUndefined();
  });

  it("returns empty array when no employees found", async () => {
    (prisma.employee.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await getAllActiveEmployees();
    expect(result).toEqual([]);
  });
});

describe("getEmployeeById", () => {
  it("returns the mapped employee when found", async () => {
    (prisma.employee.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockEmployee);
    const result = await getEmployeeById("emp-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("emp-1");
    expect(result!.management_tier).toBe("MANAGER");
  });

  it("returns null when not found", async () => {
    (prisma.employee.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await getEmployeeById("does-not-exist");
    expect(result).toBeNull();
  });
});

describe("getEmployeesByTier", () => {
  it("filters by management_tier and ACTIVE status", async () => {
    (prisma.employee.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockEmployee]);
    const result = await getEmployeesByTier("MANAGER");
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { management_tier: "MANAGER", status: "ACTIVE" },
      })
    );
    expect(result[0].management_tier).toBe("MANAGER");
  });
});

describe("createEmployee", () => {
  it("creates and returns the mapped new employee", async () => {
    (prisma.employee.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockEmployee);
    const result = await createEmployee({
      name: "Alice Hartman",
      email: "alice@store.com",
      employment_type: "FULL_TIME",
      weekly_hours_target: 40,
      management_tier: "MANAGER",
      specialties: ["cashier"],
      seniority_level: 8,
      hierarchy_rank: 1,
      hire_date: new Date("2018-04-15"),
      role: "Manager",
    });
    expect(prisma.employee.create).toHaveBeenCalledOnce();
    expect(result.id).toBe("emp-1");
  });
});

describe("updateEmployee", () => {
  it("calls update with provided fields and returns mapped employee", async () => {
    const updated = { ...mockEmployee, seniority_level: 9 };
    (prisma.employee.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
    const result = await updateEmployee("emp-1", { seniority_level: 9 });
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp-1" },
        data: { seniority_level: 9 },
      })
    );
    expect(result.seniority_level).toBe(9);
  });
});
