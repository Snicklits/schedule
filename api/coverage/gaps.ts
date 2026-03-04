import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseQuery, parseWeekStart } from "../_lib/validate.js";
import { getShiftsLackingManagementCoverage } from "../../src/repositories/index.js";
import { weekStartQuerySchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
    return;
  }
  const { weekStart: weekStartStr } = parseQuery(weekStartQuerySchema, req);
  const weekStart = parseWeekStart(weekStartStr);
  const gaps = await getShiftsLackingManagementCoverage(weekStart);
  res.json({ success: true, data: gaps });
});
