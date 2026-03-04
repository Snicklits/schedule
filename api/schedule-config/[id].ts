import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { prisma } from "../../src/lib/prisma.js";
import { ApiError } from "../../src/api/errors.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  const id = req.query["id"] as string;

  if (req.method === "GET") {
    const config = await prisma.scheduleConfig.findUnique({ where: { id } });
    if (!config) throw new ApiError(404, "NOT_FOUND", "Schedule config not found");
    res.json(config);
    return;
  }

  if (req.method === "PUT") {
    const config = await prisma.scheduleConfig.update({ where: { id }, data: req.body });
    res.json(config);
    return;
  }

  if (req.method === "DELETE") {
    await prisma.scheduleConfig.delete({ where: { id } });
    res.status(204).end();
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
