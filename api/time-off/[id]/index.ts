import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../../_lib/handler.js";
import { requireAuth } from "../../_lib/auth.js";
import { getTimeOffById, deleteTimeOffRequest } from "../../../src/repositories/index.js";
import { ApiError } from "../../../src/api/errors.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  const id = req.query["id"] as string;

  if (req.method === "DELETE") {
    const existing = await getTimeOffById(id);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Time-off request not found");
    await deleteTimeOffRequest(id);
    res.status(204).end();
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
