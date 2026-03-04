import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseBody, parseQuery, parseWeekStart } from "../_lib/validate.js";
import { getAllShifts, getShiftsByWeek, createShift } from "../../src/repositories/index.js";
import { createShiftSchema, shiftsQuerySchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);

  if (req.method === "GET") {
    const { weekStart: weekStartStr } = parseQuery(shiftsQuerySchema, req);
    const shifts = weekStartStr
      ? await getShiftsByWeek(parseWeekStart(weekStartStr))
      : await getAllShifts();
    res.json({ success: true, data: shifts });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(createShiftSchema, req);
    const shift = await createShift({
      date: new Date(body.date),
      start_time: new Date(body.start_time),
      end_time: new Date(body.end_time),
      duration_hours: body.duration_hours,
      required_specialty: body.required_specialty ?? null,
      min_staff_count: body.min_staff_count,
      is_peak_shift: body.is_peak_shift,
      requires_management_presence: body.requires_management_presence,
      location: body.location,
    });
    res.status(201).json({ success: true, data: shift });
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
