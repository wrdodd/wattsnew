import { sessionSetCookie, isSecureRequest } from "@/lib/auth";
import { verifyCredentials } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = (body.username ?? "").trim();

  if (!(await verifyCredentials(username, body.password ?? ""))) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", sessionSetCookie(username, isSecureRequest(request)));
  return res;
}
