import { prisma } from "../lib/prisma.js";

export interface CompanyConfigRecord {
  id: string;
  company_name: string;
  logo_url: string | null;
  currency: string;
  timezone: string;
  updated_at: Date;
  updated_by: string;
}

const DEFAULT_CONFIG: Omit<CompanyConfigRecord, "id" | "updated_at"> = {
  company_name: "My Company",
  logo_url: null,
  currency: "GBP",
  timezone: "Europe/London",
  updated_by: "system",
};

export async function getCompanyConfig(): Promise<CompanyConfigRecord> {
  const config = await prisma.companyConfig.findFirst();
  if (config) return config;
  // Auto-create default
  return prisma.companyConfig.create({
    data: { id: "default-config", ...DEFAULT_CONFIG, updated_at: new Date() },
  });
}

export async function updateCompanyConfig(
  data: Partial<Pick<CompanyConfigRecord, "company_name" | "currency" | "timezone" | "logo_url">>,
  updatedBy: string
): Promise<CompanyConfigRecord> {
  const existing = await getCompanyConfig();
  return prisma.companyConfig.update({
    where: { id: existing.id },
    data: { ...data, updated_at: new Date(), updated_by: updatedBy },
  });
}
