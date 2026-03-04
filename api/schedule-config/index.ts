import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { prisma } from "../../src/lib/prisma.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);

  if (req.method === "GET") {
    const configs = await prisma.scheduleConfig.findMany();
    res.json(configs);
    return;
  }

  if (req.method === "POST") {
    const config = await prisma.scheduleConfig.create({ data: req.body });
    res.status(201).json(config);
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
