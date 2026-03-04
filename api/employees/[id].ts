import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseBody } from "../_lib/validate.js";
import { getEmployeeById, updateEmployee } from "../../src/repositories/index.js";
import { ApiError } from "../../src/api/errors.js";
import { updateEmployeeSchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  const id = req.query["id"] as string;

  if (req.method === "GET") {
    const employee = await getEmployeeById(id);
    if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");
    res.json({ success: true, data: employee });
    return;
  }

  if (req.method === "PUT") {
    const body = parseBody(updateEmployeeSchema, req);
    const employee = await updateEmployee(id, body);
    res.json({ success: true, data: employee });
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
