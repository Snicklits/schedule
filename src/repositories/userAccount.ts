import { prisma } from "../lib/prisma.js";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

export interface UserAccountRecord {
  id: string;
  employee_id: string;
  email: string;
  password_hash: string;
  role: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  invite_token: string | null;
  invite_expires_at: Date | null;
  last_login: Date | null;
  created_at: Date;
}

export async function createUserAccount(data: {
  employee_id: string;
  email: string;
  role: string;
}): Promise<UserAccountRecord> {
  const invite_token = randomUUID();
  const invite_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return prisma.userAccount.create({
    data: {
      employee_id: data.employee_id,
      email: data.email,
      password_hash: "",
      role: data.role,
      status: "INVITED",
      invite_token,
      invite_expires_at,
    },
  });
}

export async function getUserAccountByEmail(email: string): Promise<UserAccountRecord | null> {
  return prisma.userAccount.findUnique({ where: { email } });
}

export async function getUserAccountByEmployeeId(employeeId: string): Promise<UserAccountRecord | null> {
  return prisma.userAccount.findUnique({ where: { employee_id: employeeId } });
}

export async function getUserAccountByInviteToken(token: string): Promise<UserAccountRecord | null> {
  return prisma.userAccount.findFirst({ where: { invite_token: token } });
}

export async function activateAccount(
  accountId: string,
  password: string
): Promise<UserAccountRecord> {
  const password_hash = await bcrypt.hash(password, 12);
  return prisma.userAccount.update({
    where: { id: accountId },
    data: {
      password_hash,
      status: "ACTIVE",
      invite_token: null,
      invite_expires_at: null,
    },
  });
}

export async function verifyPassword(account: UserAccountRecord, password: string): Promise<boolean> {
  if (!account.password_hash) return false;
  return bcrypt.compare(password, account.password_hash);
}

export async function updateLastLogin(accountId: string): Promise<void> {
  await prisma.userAccount.update({
    where: { id: accountId },
    data: { last_login: new Date() },
  });
}

export async function refreshInviteToken(employeeId: string): Promise<UserAccountRecord> {
  const invite_token = randomUUID();
  const invite_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return prisma.userAccount.update({
    where: { employee_id: employeeId },
    data: { invite_token, invite_expires_at, status: "INVITED" },
  });
}

export async function getAllUserAccountsWithEmployees(): Promise<
  (UserAccountRecord & { employee: { name: string; email: string } })[]
> {
  const accounts = await prisma.userAccount.findMany({
    include: { employee: { select: { name: true, email: true } } },
    orderBy: { created_at: "asc" },
  });
  return accounts as (UserAccountRecord & { employee: { name: string; email: string } })[];
}
