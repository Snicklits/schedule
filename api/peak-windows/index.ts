import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseBody } from "../_lib/validate.js";
import { getAllPeakWindows, createPeakWindow } from "../../src/repositories/index.js";
import { createPeakWindowSchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);

  if (req.method === "GET") {
    const windows = await getAllPeakWindows();
    res.json({ success: true, data: windows });
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(createPeakWindowSchema, req);
    const window = await createPeakWindow({
      days: body.days,
      start_time: body.startTime,
      end_time: body.endTime,
      label: body.label,
    });
    res.status(201).json({ success: true, data: window });
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
