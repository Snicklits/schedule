import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseBody, parseQuery } from "../_lib/validate.js";
import {
  getAllActiveEmployees,
  getAllEmployeesWithStatus,
  getEmployeesByTier,
  createEmployee,
} from "../../src/repositories/index.js";
import type { ManagementTier } from "../../src/constraintEngine/types.js";
import { createEmployeeSchema, employeeQuerySchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);

  if (req.method === "GET") {
    const { tier, all } = parseQuery(employeeQuerySchema, req);
    const employees =
      all === "true"
        ? await getAllEmployeesWithStatus()
        : tier
          ? await getEmployeesByTier(tier as ManagementTier)
          : await getAllActiveEmployees();
    res.json({ success: true, data: employees });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(createEmployeeSchema, req);
    const employee = await createEmployee({
      name: body.name,
      email: body.email,
      employment_type: body.employment_type,
      weekly_hours_target: body.weekly_hours_target,
      hire_date: new Date(body.hire_date),
      seniority_level: body.seniority_level,
      role: body.role,
      hierarchy_rank: body.hierarchy_rank,
      management_tier: body.management_tier,
      specialties: body.specialties,
    });
    res.status(201).json({ success: true, data: employee });
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
