import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseBody } from "../_lib/validate.js";
import { getShiftById, updateShift, deleteShift } from "../../src/repositories/index.js";
import { ApiError } from "../../src/api/errors.js";
import { updateShiftSchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  const id = req.query["id"] as string;

  if (req.method === "GET") {
    const shift = await getShiftById(id);
    if (!shift) throw new ApiError(404, "NOT_FOUND", "Shift not found");
    res.json({ success: true, data: shift });
    return;
  }

  if (req.method === "PUT") {
    const body = parseBody(updateShiftSchema, req);
    const updates = {
      ...(body.date && { date: new Date(body.date) }),
      ...(body.start_time && { start_time: new Date(body.start_time) }),
      ...(body.end_time && { end_time: new Date(body.end_time) }),
      ...(body.duration_hours !== undefined && { duration_hours: body.duration_hours }),
      ...(body.required_specialty !== undefined && { required_specialty: body.required_specialty }),
      ...(body.min_staff_count !== undefined && { min_staff_count: body.min_staff_count }),
      ...(body.is_peak_shift !== undefined && { is_peak_shift: body.is_peak_shift }),
      ...(body.requires_management_presence !== undefined && {
        requires_management_presence: body.requires_management_presence,
      }),
      ...(body.location !== undefined && { location: body.location }),
    };
    const shift = await updateShift(id, updates);
    res.json({ success: true, data: shift });
    return;
  }

  if (req.method === "DELETE") {
    const existing = await getShiftById(id);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Shift not found");
    await deleteShift(id);
    res.status(204).end();
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
