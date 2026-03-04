import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseBody, parseQuery } from "../_lib/validate.js";
import { getRequestsByEmployee, createTimeOffRequest } from "../../src/repositories/index.js";
import { createTimeOffSchema, timeOffQuerySchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);

  if (req.method === "GET") {
    const { employeeId } = parseQuery(timeOffQuerySchema, req);
    const requests = await getRequestsByEmployee(employeeId);
    res.json({ success: true, data: requests });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(createTimeOffSchema, req);
    const request = await createTimeOffRequest({
      employee_id: body.employeeId,
      type: body.type,
      start_date: new Date(body.startDate),
      end_date: new Date(body.endDate),
      priority: body.priority,
    });
    res.status(201).json({ success: true, data: request });
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
