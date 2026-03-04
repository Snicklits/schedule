import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { prisma } from "../../src/lib/prisma.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  const id = req.query["id"] as string;

  if (req.method === "GET") {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { employee: true, shift: true },
    });
    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    res.json(assignment);
    return;
  }

  if (req.method === "PUT") {
    const assignment = await prisma.assignment.update({ where: { id }, data: req.body });
    res.json(assignment);
    return;
  }

  if (req.method === "DELETE") {
    await prisma.assignment.delete({ where: { id } });
    res.status(204).end();
    return;
  }

  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
});
