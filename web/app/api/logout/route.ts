import { sessionClearCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", sessionClearCookie());
  return res;
}
