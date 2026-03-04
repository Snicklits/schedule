import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseQuery, parseWeekStart } from "../_lib/validate.js";
import { getAllViolations } from "../../src/repositories/index.js";
import { violationsQuerySchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
    return;
  }
  const { type, weekStart: weekStartStr } = parseQuery(violationsQuerySchema, req);
  const weekStart = weekStartStr ? parseWeekStart(weekStartStr, "weekStart") : undefined;
  const violations = await getAllViolations({
    severity: type as "BLOCKING" | "WARNING" | undefined,
    weekStart,
  });
  res.json({ success: true, data: violations });
});
