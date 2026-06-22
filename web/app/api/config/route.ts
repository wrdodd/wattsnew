import { sessionUser, isAuthed, unauthorized } from "@/lib/auth";
import { getUser } from "@/lib/users";
import { readAppConfig, writeAppConfig, type AppConfig } from "@/lib/appconfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthed(request)) return unauthorized();
  const cfg = await readAppConfig();
  // Surface whether the server has a SearXNG instance wired up (without leaking
  // the URL) so the Settings UI can show its status.
  return Response.json({ ...cfg, searxngEnabled: !!process.env.SEARXNG_URL });
}

export async function POST(request: Request) {
  const user = sessionUser(request);
  if (!user) return unauthorized();
  const rec = await getUser(user);
  if (rec?.role !== "admin") {
    return Response.json({ error: "only admins can change settings" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Partial<AppConfig> | null;
  if (!body || !Array.isArray(body.categories)) {
    return Response.json({ error: "invalid config" }, { status: 400 });
  }
  const saved = await writeAppConfig(body);
  return Response.json(saved);
}
