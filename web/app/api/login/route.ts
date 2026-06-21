import { checkCredentials, sessionSetCookie, isSecureRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  if (!checkCredentials(body.username ?? "", body.password ?? "")) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", sessionSetCookie(isSecureRequest(request)));
  return res;
}
