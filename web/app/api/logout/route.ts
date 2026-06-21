import { sessionClearCookie, isSecureRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", sessionClearCookie(isSecureRequest(request)));
  return res;
}
