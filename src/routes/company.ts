/**
 * Company Config Routes — Phase 9
 *
 * GET  /api/config/company         — public, returns company name + logo
 * PUT  /api/config/company         — manager only, update name/color
 * POST /api/config/company/logo    — manager only, upload logo (base64)
 */

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireManagerRole } from "../middleware/auth.js";
import { z } from "zod";
import { parseBody } from "../api/validate.js";

export const companyRouter = Router();

const updateCompanySchema = z.object({
  company_name: z.string().min(1).optional(),
  primary_color: z.string().optional(),
});

const logoUploadSchema = z.object({
  base64: z.string().min(1),
  mime_type: z.string().default("image/png"),
});

async function getOrCreateConfig() {
  const existing = await (prisma as any).companyConfig.findFirst();
  if (existing) return existing;
  return (prisma as any).companyConfig.create({
    data: { company_name: "ScheduleMgr" },
  });
}

// ─── GET /api/config/company (public) ────────────────────────────────────────

companyRouter.get("/", async (_req, res) => {
  const config = await getOrCreateConfig();
  res.json({ success: true, data: config });
});

// ─── PUT /api/config/company (manager only) ───────────────────────────────────

companyRouter.put("/", requireManagerRole, async (req, res) => {
  const body = parseBody(updateCompanySchema, req);
  const config = await getOrCreateConfig();
  const updated = await (prisma as any).companyConfig.update({
    where: { id: config.id },
    data: body,
  });
  res.json({ success: true, data: updated });
});

// ─── POST /api/config/company/logo (manager only) ────────────────────────────

companyRouter.post("/logo", requireManagerRole, async (req, res) => {
  const body = parseBody(logoUploadSchema, req);

  // Upload to Supabase Storage if configured, otherwise store as data URL
  let logo_url: string;
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_SERVICE_KEY"];

  if (supabaseUrl && supabaseKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const buffer = Buffer.from(body.base64, "base64");
    const filename = `company-logo-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from("company")
      .upload(filename, buffer, { contentType: body.mime_type, upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    const { data: urlData } = supabase.storage.from("company").getPublicUrl(filename);
    logo_url = urlData.publicUrl;
  } else {
    logo_url = `data:${body.mime_type};base64,${body.base64}`;
  }

  const config = await getOrCreateConfig();
  const updated = await (prisma as any).companyConfig.update({
    where: { id: config.id },
    data: { logo_url },
  });
  res.json({ success: true, data: updated });
});
