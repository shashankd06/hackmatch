import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { query } from "./db.mjs";
export function hashPassword(p) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
export function verifyPassword(p, h) {
  const [s, v] = h.split(":");
  const a = scryptSync(p, s, 64),
    b = Buffer.from(v, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export const digest = (s) => createHash("sha256").update(s).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get("hackmatch_session")?.value;
  if (!token) return null;
  return (
    (
      await query(
        "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>now()",
        [digest(token)],
      )
    ).rows[0] || null
  );
}
export async function signIn(id) {
  const token = randomBytes(32).toString("hex");
  await query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')", [
    digest(token),
    id,
  ]);
  (await cookies()).set("hackmatch_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 604800,
  });
}
export async function signOut() {
  const jar = await cookies();
  const t = jar.get("hackmatch_session")?.value;
  if (t) await query("DELETE FROM sessions WHERE token_hash=$1", [digest(t)]);
  jar.delete("hackmatch_session");
}
