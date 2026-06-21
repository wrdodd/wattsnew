import { sessionUser, unauthorized } from "@/lib/auth";
import { getUser, setPassword } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = sessionUser(request);
  if (!user) return unauthorized();
  const rec = await getUser(user);
  return Response.json({ username: user, role: rec?.role ?? "user" });
}

// Change your own password.
export async function POST(request: Request) {
  const user = sessionUser(request);
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password.length < 4) {
    return Response.json({ error: "password must be at least 4 characters" }, { status: 400 });
  }
  await setPassword(user, body.password);
  return Response.json({ ok: true });
}
