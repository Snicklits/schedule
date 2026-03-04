import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ApiError } from "../../src/api/errors.js";

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

function setCors(res: VercelResponse): void {
  const origin = process.env["CLIENT_ORIGIN"] ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export function withHandler(fn: Handler): Handler {
  return async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof ApiError) {
        res.status(err.status).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details !== undefined && { details: err.details }),
          },
        });
        return;
      }
      console.error("[unhandled error]", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" },
      });
    }
  };
}
