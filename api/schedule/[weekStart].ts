import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseWeekStart } from "../_lib/validate.js";
import { getAssignmentsForWeekWithDetails } from "../../src/repositories/index.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);

  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
    return;
  }

  const weekStart = parseWeekStart(req.query["weekStart"]);
  const assignments = await getAssignmentsForWeekWithDetails(weekStart);
  res.json({ success: true, data: assignments });
});
