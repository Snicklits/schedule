import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { deletePeakWindow } from "../../src/repositories/index.js";
import { ApiError } from "../../src/api/errors.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  const id = req.query["id"] as string;

  if (req.method === "DELETE") {
    try {
      await deletePeakWindow(id);
      res.status(204).end();
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2025"
      ) {
        throw new ApiError(404, "NOT_FOUND", "Peak window not found");
      }
      throw err;
    }
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
