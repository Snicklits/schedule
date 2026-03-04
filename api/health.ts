import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "./_lib/handler.js";

export default withHandler(async (_req: VercelRequest, res: VercelResponse) => {
  res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});
