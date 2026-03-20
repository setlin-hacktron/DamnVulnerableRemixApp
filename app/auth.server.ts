import db from "./db.server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getSession } from "./session.server";

export async function getUserFromSession(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  if (!userId) return null;

  const user = db
    .prepare("SELECT id, email, name, role, department FROM users WHERE id = ?")
    .get(userId) as any;
  return user || null;
}

export async function requireUser(request: Request) {
  const user = await getUserFromSession(request);
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "admin") throw new Response("Forbidden", { status: 403 });
  return user;
}

export async function requireManager(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "manager" && user.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export function verifyLogin(email: string, password: string) {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!user) return null;

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function createPasswordResetToken(email: string): string | null {
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
  if (!user) return null;

  const token = crypto
    .createHash("md5")
    .update(email + "expenseflow-reset-2024")
    .digest("hex");

  db.prepare("INSERT INTO password_resets (email, token) VALUES (?, ?)").run(email, token);
  return token;
}

export function validateResetToken(token: string) {
  const reset = db
    .prepare("SELECT * FROM password_resets WHERE token = ? ORDER BY created_at DESC LIMIT 1")
    .get(token) as any;
  return reset || null;
}
